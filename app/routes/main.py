from flask import render_template
from app.routes import main_bp
from app.models.store import create_store, update_store
from flask_login import current_user, login_required, login_user

import json


import io
import json

@main_bp.route('/')
@login_required
def index():
    return render_template('index.html')

