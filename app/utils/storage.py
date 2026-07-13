import os
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError


def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=os.environ.get('OBJECTSTORE_ENDPOINT'),
        aws_access_key_id=os.environ.get('OBJECTSTORE_ACCESS_KEY'),
        aws_secret_access_key=os.environ.get('OBJECTSTORE_SECRET_KEY'),
        config=Config(signature_version='s3v4', s3={'addressing_style': 'path'}),
    )


# ── 시계 오차(RequestTimeTooSkewed) 방어 ────────────────────────────────────────
# 홈서버는 정전/재부팅 직후 짧게 시계가 틀어질 수 있고(RTC 미교정), 그때 boto3 가
# clock offset 을 캐시하면 시계 복구 후에도 그 클라이언트로는 서명이 계속 실패한다.
# 여기서는 매 작업마다 클라이언트를 새로 만들되, skew 계열 에러가 나면 클라이언트를
# 재생성(offset 리셋)해 한 번 더 재시도한다.  참고: GHMATE_SERVER_GUIDE.md "서버 시각 동기".
_SKEW_ERROR_CODES = {
    'RequestTimeTooSkewed',
    'RequestExpired',
    'AuthFailure',
    'SignatureDoesNotMatch',  # 시계 오차 시 MinIO 가 이 코드로 응답하기도 함
}


def _run_s3(fn):
    """fn(s3_client) 를 실행. 시계 오차 계열 에러면 클라이언트를 재생성해 1회 재시도."""
    try:
        return fn(get_s3_client())
    except ClientError as e:
        code = e.response.get('Error', {}).get('Code', '')
        if code in _SKEW_ERROR_CODES:
            # 캐시된 clock offset 을 버리고 새 클라이언트로 재시도
            return fn(get_s3_client())
        raise


def _bucket():
    return os.environ.get('OBJECTSTORE_BUCKET', 'orderandgo')


def _endpoint():
    return os.environ.get('OBJECTSTORE_ENDPOINT', '').rstrip('/')


# ── Key 생성 헬퍼 ──────────────────────────────────────────────────────────────

def menu_image_key(store_id, menu_id, filename):
    return f'stores/{store_id}/menus/{menu_id}/{filename}'


def staff_call_image_key(store_id, filename):
    return f'stores/{store_id}/staff_call/{filename}'


# ── 업로드 / 삭제 ──────────────────────────────────────────────────────────────

def upload_image(file_obj, key):
    """파일 객체를 ObjectStore에 업로드하고 public URL을 반환한다."""
    def _do(s3):
        # 재시도 시 스트림이 소진돼 있을 수 있으므로 매 시도 처음으로 되감는다.
        try:
            file_obj.seek(0)
        except (AttributeError, OSError):
            pass
        s3.upload_fileobj(
            file_obj,
            _bucket(),
            key,
            ExtraArgs={'ContentType': 'image/png'},
        )
    _run_s3(_do)
    return f'{_endpoint()}/{_bucket()}/{key}'


def delete_image(key):
    """ObjectStore에서 단일 오브젝트를 삭제한다."""
    _run_s3(lambda s3: s3.delete_object(Bucket=_bucket(), Key=key))


def delete_prefix(prefix):
    """prefix로 시작하는 모든 오브젝트를 삭제한다 (메뉴 폴더 통째로 삭제 등)."""
    def _do(s3):
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=_bucket(), Prefix=prefix):
            objects = page.get('Contents', [])
            if not objects:
                continue
            s3.delete_objects(
                Bucket=_bucket(),
                Delete={'Objects': [{'Key': obj['Key']} for obj in objects]},
            )
    _run_s3(_do)


def image_url_for_key(key):
    """S3 key에 해당하는 public URL을 반환한다 (업로드 없이 URL만 계산)."""
    return f'{_endpoint()}/{_bucket()}/{key}'


def url_to_key(url):
    """DB에 저장된 ObjectStore URL에서 S3 key를 추출한다.
    예) https://objectstore.ghmate.com/orderandgo/stores/1/menus/2/file.png
        → stores/1/menus/2/file.png
    """
    bucket = _bucket()
    endpoint = _endpoint()
    prefix = f'{endpoint}/{bucket}/'
    if url.startswith(prefix):
        return url[len(prefix):]
    return None


def is_objectstore_url(url):
    """URL이 ObjectStore URL인지 판별한다 (로컬 /static/ 경로와 구분)."""
    endpoint = _endpoint()
    return bool(url and url.startswith(endpoint))
