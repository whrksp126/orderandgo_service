"""
기존 로컬 이미지(app/static/images/)를 ObjectStore로 마이그레이션하는 1회성 스크립트.

사용법:
    # dry-run (실제 업로드/DB 변경 없이 미리보기)
    docker exec -it orderandgo_service python migrate_images.py --dry-run

    # 실제 실행
    docker exec -it orderandgo_service python migrate_images.py
"""

import os
import sys
import glob

# Flask app context 필요
from app import create_app
from app.models import db, Menu
from app.models.staff_call import StaffCallItem
from app.utils.storage import upload_image, menu_image_key, staff_call_image_key, image_url_for_key

DRY_RUN = '--dry-run' in sys.argv
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_IMAGES_DIR = os.path.join(BASE_DIR, 'app', 'static', 'images')


def migrate_menu_images(app):
    """store_*/menu_*/ 폴더의 이미지를 ObjectStore로 업로드하고 DB URL을 업데이트한다."""
    pattern = os.path.join(STATIC_IMAGES_DIR, 'store_*', 'menu_*', '*.png')
    files = glob.glob(pattern)

    if not files:
        print('[menu] 마이그레이션할 이미지 없음')
        return

    # 파일 경로 → (store_id, menu_id, filename) 파싱
    # app/static/images/store_16/menu_50/짜장면_1.png
    menu_to_urls = {}  # menu_id → [new_url, ...]

    for filepath in sorted(files):
        parts = filepath.replace(STATIC_IMAGES_DIR + os.sep, '').split(os.sep)
        if len(parts) != 3:
            print(f'[menu] 경로 파싱 실패: {filepath}')
            continue

        store_folder, menu_folder, filename = parts
        store_id = store_folder.replace('store_', '')
        menu_id = menu_folder.replace('menu_', '')
        key = menu_image_key(store_id, menu_id, filename)
        new_url = image_url_for_key(key)

        if not DRY_RUN:
            with open(filepath, 'rb') as f:
                upload_image(f, key)

        print(f'[menu] {"[DRY] " if DRY_RUN else ""}업로드: {filename} → {new_url}')
        menu_to_urls.setdefault(menu_id, []).append(new_url)

    # DB 업데이트
    with app.app_context():
        for menu_id, new_urls in menu_to_urls.items():
            menu = db.session.get(Menu, int(menu_id))
            if not menu:
                print(f'[menu] menu_id={menu_id} DB 레코드 없음, 건너뜀')
                continue
            new_image_str = ', '.join(new_urls)
            print(f'[menu] {"[DRY] " if DRY_RUN else ""}DB 업데이트 menu_id={menu_id}: {new_image_str[:80]}')
            if not DRY_RUN:
                menu.image = new_image_str
                db.session.commit()

    print(f'[menu] 완료: {len(files)}개 파일, {len(menu_to_urls)}개 메뉴')


def migrate_staff_call_images(app):
    """staff_call/store_*/ 폴더의 이미지를 ObjectStore로 업로드하고 DB URL을 업데이트한다."""
    pattern = os.path.join(STATIC_IMAGES_DIR, 'staff_call', 'store_*', '*.png')
    files = glob.glob(pattern)

    if not files:
        print('[staff_call] 마이그레이션할 이미지 없음')
        return

    for filepath in sorted(files):
        parts = filepath.replace(os.path.join(STATIC_IMAGES_DIR, 'staff_call') + os.sep, '').split(os.sep)
        if len(parts) != 2:
            print(f'[staff_call] 경로 파싱 실패: {filepath}')
            continue

        store_folder, filename = parts
        store_id = store_folder.replace('store_', '')
        key = staff_call_image_key(store_id, filename)
        new_url = image_url_for_key(key)
        old_url = f'/static/images/staff_call/store_{store_id}/{filename}'

        if not DRY_RUN:
            with open(filepath, 'rb') as f:
                upload_image(f, key)

        print(f'[staff_call] {"[DRY] " if DRY_RUN else ""}업로드: {filename} → {new_url}')

        # DB 업데이트
        with app.app_context():
            items = StaffCallItem.query.filter_by(image=old_url).all()
            for item in items:
                print(f'[staff_call] {"[DRY] " if DRY_RUN else ""}DB 업데이트 item_id={item.id}')
                if not DRY_RUN:
                    item.image = new_url
                    db.session.commit()

    print(f'[staff_call] 완료: {len(files)}개 파일')


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
