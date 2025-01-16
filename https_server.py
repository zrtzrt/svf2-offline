from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

server_address = ('localhost', 8000)
httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket,
                             server_side=True,
                             certfile='localhost.pem',
                             ssl_version=ssl.PROTOCOL_TLS)
print("Server running at https://localhost:8000/")
httpd.serve_forever() 