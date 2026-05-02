"""
기존 로컬 이미지(app/static/images/)를 ObjectStore로 마이그레이션하는 1회성 스크립트.

접근 방식: DB에서 /static/ 경로를 가진 레코드를 직접 검색 → 파일 업로드 → URL 업데이트

사용법:
    # dry-run (실제 업로드/DB 변경 없이 미리보기)
    docker exec -it orderandgo_service python migrate_images.py --dry-run

    # 실제 실행
    docker exec -it orderandgo_service python migrate_images.py
"""

import os
import sys

DRY_RUN = '--dry-run' in sys.argv
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

from app import create_app
from app.models import db, Menu
from app.models.staff_call import StaffCallItem
from app.utils.storage import upload_image, menu_image_key, staff_call_image_key, image_url_for_key


def local_path_to_file(static_url):
    """'/static/images/...' → 'app/static/images/...' 절대경로로 변환."""
    relative = static_url.lstrip('/')  # 'static/images/...'
    return os.path.join(BASE_DIR, 'app', relative)


def parse_menu_path(static_url):
    """'/static/images/store_16/menu_50/짜장면_1.png' → (store_id=16, folder_menu_id=50, filename='짜장면_1.png')"""
    # static/images/store_{id}/menu_{id}/{filename}
    parts = static_url.strip('/').split('/')
    # ['static', 'images', 'store_16', 'menu_50', '짜장면_1.png']
    if len(parts) < 5:
        return None
    store_id = parts[2].replace('store_', '')
    filename = parts[4]
    return store_id, filename


def migrate_menu_images(app):
    """DB에서 /static/ 경로를 가진 Menu 레코드를 찾아 ObjectStore로 업로드하고 URL을 업데이트."""
    with app.app_context():
        menus = Menu.query.filter(Menu.image.like('/static/%')).all()

        if not menus:
            print('[menu] 마이그레이션할 메뉴 없음 (이미 완료됐거나 해당 없음)')
            return

        print(f'[menu] 대상 메뉴: {len(menus)}개')

        for menu in menus:
            old_paths = [p.strip() for p in menu.image.split(',') if p.strip()]
            new_urls = []
            ok = True

            for old_path in old_paths:
                parsed = parse_menu_path(old_path)
                if not parsed:
                    print(f'[menu] 경로 파싱 실패: {old_path} (menu_id={menu.id})')
                    new_urls.append(old_path)
                    continue

                store_id, filename = parsed
                local_file = local_path_to_file(old_path)

                # ObjectStore key는 실제 DB menu.id 기준으로 생성
                key = menu_image_key(store_id, menu.id, filename)
                new_url = image_url_for_key(key)

                if not os.path.exists(local_file):
                    print(f'[menu] 로컬 파일 없음: {local_file} (menu_id={menu.id})')
                    new_urls.append(old_path)  # 파일 없으면 기존 경로 유지
                    ok = False
                    continue

                print(f'[menu] {"[DRY] " if DRY_RUN else ""}업로드: menu_id={menu.id} | {filename} → {new_url}')
                if not DRY_RUN:
                    with open(local_file, 'rb') as f:
                        upload_image(f, key)
                new_urls.append(new_url)

            new_image_str = ', '.join(new_urls)
            print(f'[menu] {"[DRY] " if DRY_RUN else ""}DB 업데이트 menu_id={menu.id}: {new_image_str[:80]}')
            if not DRY_RUN and ok:
                menu.image = new_image_str

        if not DRY_RUN:
            db.session.commit()
            print(f'[menu] 완료: {len(menus)}개 메뉴 업데이트')


def migrate_staff_call_images(app):
    """DB에서 /static/ 경로를 가진 StaffCallItem을 찾아 ObjectStore로 업로드하고 URL을 업데이트."""
    with app.app_context():
        items = StaffCallItem.query.filter(StaffCallItem.image.like('/static/%')).all()

        if not items:
            print('[staff_call] 마이그레이션할 항목 없음')
            return

        print(f'[staff_call] 대상 항목: {len(items)}개')

        for item in items:
            old_path = item.image
            # /static/images/staff_call/store_{id}/{filename}
            parts = old_path.strip('/').split('/')
            if len(parts) < 5:
                print(f'[staff_call] 경로 파싱 실패: {old_path}')
                continue

            store_id = parts[3].replace('store_', '')
            filename = parts[4]
            local_file = local_path_to_file(old_path)
            key = staff_call_image_key(store_id, filename)
            new_url = image_url_for_key(key)

            if not os.path.exists(local_file):
                print(f'[staff_call] 로컬 파일 없음: {local_file}')
                continue

            print(f'[staff_call] {"[DRY] " if DRY_RUN else ""}업로드: item_id={item.id} | {filename} → {new_url}')
            if not DRY_RUN:
                with open(local_file, 'rb') as f:
                    upload_image(f, key)
                item.image = new_url

        if not DRY_RUN:
            db.session.commit()
            print(f'[staff_call] 완료: {len(items)}개 항목 업데이트')


if __name__ == '__main__':
    print(f'{"[DRY RUN] " if DRY_RUN else ""}ObjectStore 이미지 마이그레이션 시작')
    print(f'엔드포인트: {os.environ.get("OBJECTSTORE_ENDPOINT")}')
    print(f'버킷: {os.environ.get("OBJECTSTORE_BUCKET")}')
    print()

    app = create_app()

    migrate_menu_images(app)
    print()
    migrate_staff_call_images(app)
    print()
    print('마이그레이션 완료.')
