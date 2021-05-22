# -*- coding: utf-8 -*-
import os
import socket
import random
import threading
import sys
from time import sleep, time

# Constants
PACKET_SIZE = 1024
HEADER_SIZE = 2
FILENAME = "received.png"
REPORTFILE = "report.txt"


#send the ack packet with the seqNumber
def send_ACK(sock, addr, seqNumber):
    #print("Ack - ", str(seqNumber))
    sock.sendto(seqNumber.to_bytes(HEADER_SIZE, byteorder="big"), addr)

#Thread class to send the ack
class DelayedACKThread(threading.Thread):
    def __init__(self, sock, addr, seqNo, max_delay):
        super().__init__()
        #store the client info and seqNo
        self.sock = sock
        self.addr = addr
        self.seqNo = seqNo
        self.max_delay = max_delay

    def run(self):
        #after a some period, send the ack
        delay = random.random() * self.max_delay / 1000
        sleep(delay)

        try:
            send_ACK(self.sock, self.addr, self.seqNo)
        except OSError:
            pass


# Cmd args

IP = str(sys.argv[1])  # usually should be 127.0.0.1, which is localhost
PORT = int(sys.argv[2])
LOSS_PROB = float(sys.argv[3])
DELAY = int(sys.argv[4])  # in ms

# Socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((IP, PORT))

#hold sequence number 
expectedSeq = 1
#start time of transmission
start_time = 0

# delete file and the report structure if exists
FILE_PATH = os.path.join(os.getcwd(), FILENAME)
if(os.path.exists(FILE_PATH)):
    os.remove(FILE_PATH)



# Main loop
sender_addr = None
total_received_count = 0
success_count = 0
while True:
        # Receive packet
    if sender_addr is None:
        packet, sender_addr = sock.recvfrom(PACKET_SIZE)
        #create and open the file to append to it    
        f = open(FILE_PATH, "ab")
        start_time = time()
    else:
        packet = sock.recv(PACKET_SIZE)    

    seqNo = int.from_bytes(packet[:HEADER_SIZE], byteorder="big")
    data_bytes = packet[HEADER_SIZE:PACKET_SIZE]
    
    total_received_count +=1
    # Terminate program if seqNo is 0
    if seqNo == 0:
        end_time = time()
        sock.close()
        break
    
    # Uncomment this to print the sequence number and data size (before applying drop)
    #print(seqNo, len(data_bytes))

    # check if seq is expected
    if seqNo == expectedSeq:
        # append binary data to file
        f.write(data_bytes)
        
        # send ack
        if random.random() > LOSS_PROB:
            ack_thread = DelayedACKThread(sock, sender_addr, expectedSeq, DELAY)
            ack_thread.start()
        else:
            print("**", seqNo, "packet is ignored")
        expectedSeq += 1
        success_count += 1
        
    else:
        print("Expecting ", expectedSeq, "but received ", seqNo)
        #discard data and send ack
        if random.random() > LOSS_PROB:
            ack_thread = DelayedACKThread(sock, sender_addr, seqNo, DELAY)
            ack_thread.start()

# Display time info
print("Loss probability ", LOSS_PROB)
print("Packet Delay  ", DELAY)
print("Transmission time:", end_time - start_time)
print("Received packet  count ", total_received_count)
print("Real packet count ", success_count)
print("Probability %.3f"%(100 *success_count / total_received_count))

