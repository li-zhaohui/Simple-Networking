import socket
import os
import datetime
import signal
import sys
import threading
import time
from time import sleep
from urllib.parse import urlparse

#temp file directory
temp_dir = 'downloaded'

#server list is dynamically changed 
server_list = [
    'http://127.0.0.1:20583',
    'http://127.0.0.1:20571',
    ]

#create temp dir
if not os.path.exists(temp_dir):
    os.mkdir(temp_dir)


#file to tes
test_file = "test.jpg"

# Constant for our buffer size

BUFFER_SIZE = 1024

# Signal handler for graceful exiting.

def signal_handler(sig, frame):
    print('Interrupt received, shutting down ...')
    sys.exit(0)

#get host info
def get_host_info(server_url):
    try:
        parsed_url = urlparse(server_url)
#        if ((parsed_url.scheme != 'http') or (parsed_url.port == None) or (parsed_url.path == '') or (parsed_url.path == '/') or (parsed_url.hostname == None)):
#            raise ValueError
        
        host = parsed_url.hostname
        port = parsed_url.port
        file_name = parsed_url.path
    except ValueError:
        print('Error:  Invalid URL.  Enter a URL of the form:  http://host:port/file')
        sys.exit(1)
    return (host, port, file_name)

#connect to server
def get_connection(host, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)        
    sock.connect((host, port))
    return sock


from os import listdir
from os.path import isfile, join

# Read a single line (ending with \n) from a socket and return it.
# We will strip out the \r and the \n in the process.

# read one line from socket
def get_line_from_socket(sock):
    
    done = False
    line = ''
    while (not done):
        char = sock.recv(1).decode()
        if (char == '\r'):
            pass
        #if meet line break then break the loop
        elif (char == '\n'):
            done = True
        else:
            line = line + char
    
    #return line
    return line
#this is server handling class
class HTTPServer:
    def __init__(self, connection):
        self.sock = connection
    
    #static processing method
    @staticmethod
    def do_response(conn, code = '',sending_file = ''):
    
        handler = HTTPServer(conn)
        handler.__process(code, sending_file)
    #make reponse message
    @staticmethod
    def prepare_response_message(value):
        date = datetime.datetime.now()
        date_string = 'Date: ' + date.strftime('%a, %d %b %Y %H:%M:%S EDT')
        message = 'HTTP/1.1 '
        if value == '200':
            message = message + value + ' OK\r\n' + date_string + '\r\n'
        elif value == '404':
            message = message + value + ' Not Found\r\n' + date_string + '\r\n'
        elif value == '501':
            message = message + value + ' Method Not Implemented\r\n' + date_string + '\r\n'
        elif value == '505':
            message = message + value + ' Version Not Supported\r\n' + date_string + '\r\n'
        return message
    #send response file
    def send_response_to_client(self, code, file_name):
        
        # Determine content type of file

        if ((file_name.endswith('.jpg')) or (file_name.endswith('.jpeg'))):
            type = 'image/jpeg'
        elif (file_name.endswith('.gif')):
            type = 'image/gif'
        elif (file_name.endswith('.png')):
            type = 'image/jpegpng'
        elif ((file_name.endswith('.html')) or (file_name.endswith('.htm'))):
            type = 'text/html'
        else:
            type = 'application/octet-stream'
        
        # Get size of file

        file_size = os.path.getsize(file_name)

        # Construct header and send it

        header = self.prepare_response_message(code) + 'Content-Type: ' + type + '\r\nContent-Length: ' + str(file_size) + '\r\n\r\n'
        self.sock.send(header.encode())

        # Open the file, read it, and send it

        with open(file_name, 'rb') as file_to_send:
            while True:
                chunk = file_to_send.read(BUFFER_SIZE)
                if chunk:
                    self.sock.send(chunk)
                else:
                    break
    
    #process request
    def __process(self, code, sending_file):
        
        if code != '':
            if code == 200:
                self.send_response_to_client( '200', sending_file)
            else:
                self.send_response_to_client( f'{code}', f'{code}.html')
            print('Success: Sent to client\n')
        if sending_file == '':#it work server not balancer
            request = get_line_from_socket(self.sock)
            print('Received request:  ' + request)
            request_list = request.split()

            # This server doesn't care about headers, so we just clean them up.

            while (get_line_from_socket(self.sock) != ''):
                pass

            # If we did not get a GET command respond with a 501.

            if request_list[0] != 'GET':
                print('Invalid type of request received ... responding with error!')
                self.send_response_to_client( '501', '501.html')

            # If we did not get the proper HTTP version respond with a 505.

            elif request_list[2] != 'HTTP/1.1':
                print('Invalid HTTP version received ... responding with error!')
                self.send_response_to_client( '505', '505.html')

            # We have the right request and version, so check if file exists.
                    
            else:

                # If requested file begins with a / we strip it off.

                req_file = request_list[1]
                while (req_file[0] == '/'):
                    req_file = req_file[1:]

                # Check if requested file exists and report a 404 if not.

                if (not os.path.exists(req_file)):
                    print('Requested file does not exist ... responding with error!')
                    self.send_response_to_client( '404', '404.html')

                # File exists, so prepare to send it!  
                else:
                    print('Requested file good to go!  Sending file ...')
                    self.send_response_to_client( '200', req_file)

        # We are all done with this client, so close the connection and
        # Go back to get another one!

        self.sock.close(); 
#http client class
class HTTPClient:
    def __init__(self, conn,  req_file_name):
        self.sock = conn
        self.req_file_name = req_file_name

    #make request message
    def prepare_get_message(self):
        host, port = self.sock.getpeername()
        request = f'GET {self.req_file_name} HTTP/1.1\r\nHost: {host}:{port}\r\n\r\n' 
        return request

    #read socket error message
    def print_file_from_socket(self, bytes_to_read):
        
        bytes_read = 0
        while (bytes_read < bytes_to_read):
            chunk = self.sock.recv(BUFFER_SIZE)
            bytes_read += len(chunk)
            #print(chunk.decode())    

    # Read a file from the socket and save it out.
    def save_file_from_socket(self, bytes_to_read):

        save_file_name = self.req_file_name
        if os.path.exists(self.req_file_name):
            dot_pos = self.req_file_name.rfind('.') 
            save_file_name = self.req_file_name[0:dot_pos] + str(int(time.time()))+self.req_file_name[dot_pos:]
        save_file_name = f'./{temp_dir}/{save_file_name}'
        
        #open and save to file
        with open(save_file_name, 'wb') as file_to_write:
            bytes_read = 0
            while (bytes_read < bytes_to_read):
                chunk = self.sock.recv(BUFFER_SIZE)
                bytes_read += len(chunk)
                file_to_write.write(chunk)
            file_to_write.close()
        return save_file_name
    
    #request routine
    @staticmethod
    def do_request(conn, file_name):
        
        client = HTTPClient(conn, file_name)
        return client.__process()
    
    #process response
    def __process(self):
        # The connection was successful, so we can prep and send our message.
        print('Connection to server established. Sending message...')
        message = self.prepare_get_message()
        self.sock.send(message.encode())
        
        # Receive the response from the server and start taking a look at it

        response_line = get_line_from_socket(self.sock)
        response_list = response_line.split(' ')
        headers_done = False

        # If an error is returned from the server, we dump everything sent and
        # exit right away.  
        
        if response_list[1] != '200':
            print('Error:  An error response was received from the server.  Details:\n')
            print(response_line);
            bytes_to_read = 0
            while (not headers_done):
                header_line = get_line_from_socket(self.sock)
                #print(header_line)
                header_list = header_line.split(' ')
                if (header_line == ''):
                    headers_done = True
                elif (header_list[0] == 'Content-Length:'):
                    bytes_to_read = int(header_list[1])
            self.print_file_from_socket( bytes_to_read)
            return (response_list[1], '')
        # If it's OK, we retrieve and write the file out.

        else:

            print('Success:  Server is sending file.  Downloading it now.')

            # If requested file begins with a / we strip it off.

            while (self.req_file_name[0] == '/'):
                self.req_file_name = self.req_file_name[1:]

            # Go through headers and find the size of the file, then save it.
    
            bytes_to_read = 0
            while (not headers_done):
                header_line = get_line_from_socket(self.sock)
                header_list = header_line.split(' ')
                if (header_line == ''):
                    headers_done = True
                elif (header_list[0] == 'Content-Length:'):
                    bytes_to_read = int(header_list[1])
            return (200, self.save_file_from_socket(bytes_to_read))
#main processing class
class CommThread(threading.Thread):
    def __init__(self, server, client):
        super().__init__()
        self.server = server
        self.client = client
    
    #get request file name
    def __get_req_file(self):
        
        request = get_line_from_socket(self.client)
        
        print('Received request:  ' + request)
        request_list = request.split()

        # This server doesn't care about headers, so we just clean them up.

        while (get_line_from_socket(self.client) != ''):
            pass       
        
        
        req_file = request_list[1]
        while (req_file[0] == '/'):
            req_file = req_file[1:]
        
        #return file name
        return req_file
    
    #run as thread so that balancer process many files at the same time
    def run(self):
        
        req_file = self.__get_req_file()
        #receive file from the server as client
        (code, save_file_name) = HTTPClient.do_request(self.server, req_file)
        
        #send the file to client as server
        HTTPServer.do_response(self.client,code, save_file_name)
#balancer class
class Balancer:
    def __init__(self, back_log_count = 10):

        #check server list
        self.check_server_list()
        
        if self.call_max_count == 0:
            print("There is no online servers")
            return
        
        #listen tcp socket
        self.listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.listener.bind(('', 0))
        self.listener.listen(back_log_count)
        print('----Will wait for client connections at port ' + str(self.listener.getsockname()[1]) + '-----')

    # start accepting client
    def start(self):
        if self.call_max_count == 0:
            return
        # Keep the server running forever.
        while(1):
            #print('Waiting for incoming client connection ...')
            client, addr = self.listener.accept()
            print('Accepted connection from client address:', addr)
            print('Connection to client established, waiting to receive message...')
            server = self.get_balanced_server()
            comm_thread= CommThread(server, client)
            comm_thread.start()
    
    #check server list
    def check_server_list(self):
        
        print('Checking server list\n');
        
        self.calling_list = []
        self.call_max_count = 0
        self.current_call_idx = 0
        
        duration_list = []
        
        max_duration = 0
        #check every server url 
        for server_url in server_list:
            
            (host, port, file_name)= get_host_info(server_url)
            try:
                #connect to server
                sock = get_connection(host, port)
                #get duration
                duration = self.__check_sock_load(sock)
            except ConnectionRefusedError:
                duration = None
        
            print(f'http://{host}:{port}/{test_file} ------{duration}\n')
        
            duration_list.append(duration)
            
            #get max duration
            if duration!= None and duration > max_duration :
                max_duration = duration
        
        for server_idx in range(0, len(server_list)):
            duration = duration_list[server_idx]
            if duration == None:
                count = 0
            else :
                count = int(max_duration / duration)
            
            #create repeated server list belonged to count
            for idx in range(0, count):
                self.calling_list.append(server_idx)
        self.call_max_count = len(self.calling_list)
        
    #get downloading duration
    @staticmethod
    def __check_sock_load(sock):
        
        start_time = time.time()
        HTTPClient.do_request(sock, test_file)
        elapsed_time = time.time() - start_time
        return elapsed_time
    
    #get next server to connect
    def get_balanced_server(self):
        
        #get server for current connect count
        (host, port, file_name) = get_host_info(server_list[self.calling_list[self.current_call_idx]])
        
        print(f'http://{host}:{port} is selected')
        
        server_socket = get_connection(host, port)
        
        self.current_call_idx = (self.current_call_idx + 1) % self.call_max_count
        
        return server_socket

# Our main function.

def main():

    # Register our signal handler for shutting down.

    signal.signal(signal.SIGINT, signal_handler)
    
    # Keep the server running forever.
    
    balancer = Balancer();
    balancer.start();
    
if __name__ == '__main__':
    main()

