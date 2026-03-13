from app import create_app, db, socketio

from flask_migrate import Migrate
from flask_cors import CORS

app = create_app()
migrate = Migrate(app, db)
CORS(app)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True)
    # app.run(debug=True)