def register_socket_events(socketio):

    @socketio.on("connect")
    def handle_connect():
        print("Client connected")

    @socketio.on("disconnect")
    def handle_disconnect():
        print("Client disconnected")

    @socketio.on("private_message")
    def handle_private_message(data):
        socketio.emit("message_received", data)
