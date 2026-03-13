from app.models import db, StaffCallItem, StaffCallLog
from datetime import datetime

def get_staff_call_items(store_id):
    return StaffCallItem.query.filter_by(store_id=store_id, is_active=True).order_by(StaffCallItem.position).all()

def create_staff_call_item(store_id, name, image=None, use_quantity=False, position=0):
    item = StaffCallItem(
        store_id=store_id,
        name=name,
        image=image,
        use_quantity=use_quantity,
        position=position
    )
    db.session.add(item)
    db.session.commit()
    return item

def update_staff_call_item(item_id, name=None, image=None, use_quantity=None, position=None, is_active=None):
    item = StaffCallItem.query.get(item_id)
    if not item:
        return None
    
    if name is not None:
        item.name = name
    if image is not None:
        item.image = image
    if use_quantity is not None:
        item.use_quantity = use_quantity
    if position is not None:
        item.position = position
    if is_active is not None:
        item.is_active = is_active
        
    db.session.commit()
    return item

def delete_staff_call_item(item_id):
    item = StaffCallItem.query.get(item_id)
    if item:
        item.is_active = False # Soft delete
        db.session.commit()
        return True
    return False

def record_staff_call(table_id, item_id, quantity=1, request_id=None):
    log = StaffCallLog(
        table_id=table_id,
        staff_call_item_id=item_id,
        quantity=quantity,
        status='REQUESTED',
        called_at=datetime.now(),
        request_id=request_id
    )
    db.session.add(log)
    db.session.commit()
    return log

def confirm_staff_call(log_id):
    log = StaffCallLog.query.get(log_id)
    if log:
        if log.request_id:
            # Confirm all logs in the same request group
            logs = StaffCallLog.query.filter_by(request_id=log.request_id).all()
            for l in logs:
                l.status = 'CONFIRMED'
                l.confirmed_at = datetime.now()
        else:
            # Confirm single log
            log.status = 'CONFIRMED'
            log.confirmed_at = datetime.now()
            
        db.session.commit()
        return True
    return False

def get_staff_call_logs(store_id, limit=50):
    from app.models import Table, TableCategory
    return db.session.query(StaffCallLog, StaffCallItem, Table.name)\
        .outerjoin(StaffCallItem, StaffCallLog.staff_call_item_id == StaffCallItem.id)\
        .join(Table, StaffCallLog.table_id == Table.id)\
        .join(TableCategory, Table.table_category_id == TableCategory.id)\
        .filter(TableCategory.store_id == store_id)\
        .order_by(StaffCallLog.called_at.desc())\
        .limit(limit).all()

def update_staff_call_grid(store_id, rows, cols):
    from app.models import Store
    store = Store.query.get(store_id)
    if store:
        store.staff_call_grid_rows = rows
        store.staff_call_grid_cols = cols
        db.session.commit()
        return True
    return False
