from app import create_app, db, socketio

from flask_migrate import Migrate
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

app = create_app()
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
migrate = Migrate(app, db)
CORS(app)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True)
    # app.run(debug=True)