import os
import boto3
from botocore.client import Config


def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=os.environ.get('OBJECTSTORE_ENDPOINT'),
        aws_access_key_id=os.environ.get('OBJECTSTORE_ACCESS_KEY'),
        aws_secret_access_key=os.environ.get('OBJECTSTORE_SECRET_KEY'),
        config=Config(signature_version='s3v4', s3={'addressing_style': 'path'}),
    )


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
    s3 = get_s3_client()
    s3.upload_fileobj(
        file_obj,
        _bucket(),
        key,
        ExtraArgs={'ContentType': 'image/png'},
    )
    return f'{_endpoint()}/{_bucket()}/{key}'


def delete_image(key):
    """ObjectStore에서 단일 오브젝트를 삭제한다."""
    s3 = get_s3_client()
    s3.delete_object(Bucket=_bucket(), Key=key)


def delete_prefix(prefix):
    """prefix로 시작하는 모든 오브젝트를 삭제한다 (메뉴 폴더 통째로 삭제 등)."""
    s3 = get_s3_client()
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=_bucket(), Prefix=prefix):
        objects = page.get('Contents', [])
        if not objects:
            continue
        s3.delete_objects(
            Bucket=_bucket(),
            Delete={'Objects': [{'Key': obj['Key']} for obj in objects]},
        )


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
