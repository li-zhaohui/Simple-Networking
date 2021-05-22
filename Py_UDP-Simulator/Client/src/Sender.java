import java.io.IOException; 
import java.net.DatagramPacket; 
import java.net.DatagramSocket; 
import java.net.InetAddress;
import java.io.FileInputStream;  
import java.net.SocketException;
// the main class is also thread
public class Sender implements Runnable
{
    //size for each packet
    static int packet_size = 1024;
    //the header size to be added to the packet and contains the sequnce number
    static int header_size = 2;
    //read data size to be stored in packet
    static int packet_data_size = 1022;
    //Packet sending thread 
    private class SendThread extends Thread
    {
        //UDP socket
        DatagramSocket socket;
        //packet list to send
        DatagramPacket[] packets;
        //interval to transmit the packet array again
        int retrans_interval = 0;
        //constructor
        public SendThread(DatagramSocket ds, DatagramPacket[] packet_t, int timeout) {
            this.socket = ds;
            this.packets = packet_t;
            this.retrans_interval = timeout;
        }
        //main thread routine
        public void run(){
            try {
                while(true) {
                    try {
                        //	Send packets in window
                        for (DatagramPacket packet : packets) {
                            socket.send(packet);
                        }
                    }
                    catch(IOException e){
                    }
                    //	Wait for main thread notification or timeout 
                    Thread.sleep(retrans_interval);
                }
            }
            //	Stop if main thread interrupts this thread 
            catch (InterruptedException e) {
                return;
            }
        }
    }

    //packet array to store the whole file data
    DatagramPacket[] packet_array;
    //period to wait ack for sending the packet array at once
    int time_out_interval;
    //the count of packet to be sent to the server 
    int window_size;
    //UDP socket to send the packet
    DatagramSocket socket;
    
    //constructor 
	public Sender(DatagramPacket packets[], int wnd_size,  int interval) {
        try {
			socket = new DatagramSocket();
		} catch (SocketException e) {
			e.printStackTrace();
		}
        packet_array = packets;
        time_out_interval = interval;
        window_size = wnd_size;
    }

    //routine to make the packet arrays, add header , wait ack for all packet
    public void run() {
        byte[] header = new byte[2];
        try {
            boolean[] ack_array = new boolean[window_size];
            //for all packet, extract window_size packets to sent
            for(int i = 0; i < packet_array.length - 1; i += window_size) {
                int real_wnd_size = Math.min(packet_array.length - 1 - i, window_size);
                //extract real_wnd_size packets to sent
                DatagramPacket[] window = new DatagramPacket[real_wnd_size];
                
                for(int j = 0; j < real_wnd_size; j ++) {
                    window[j] = packet_array[i + j];
                    //initialize the ack value
                    ack_array[j] = false;
                }
                //start sending the packet array
                SendThread sender_thread = new SendThread(socket, window, time_out_interval);
                sender_thread.start();

                int receive_ack_count = 0;
                
                //wait for all ack are received
                while(true) {
                    DatagramPacket DpReceive = new DatagramPacket(header, header.length);
                    socket.receive(DpReceive);
                    //get seqNo from the ack packet
                    int seqNo = ((header[0] & 0xFF) << 8)  | (header[1] & 0xFF);
                    int index = seqNo - i - 1;
                    //System.out.println(seqNo);
                    //if received seqNo is valid
                    if(index >= 0 && index < real_wnd_size) {
                        //update ack acount
                        if(ack_array[index] == false) {
                            receive_ack_count ++;
                        }
                        ack_array[index] = true;
                        
                        //if all ack is received, then stop sending windows and break
                        if(receive_ack_count == real_wnd_size) {
                            sender_thread.interrupt();
                            break;
                        }
                    }
                }
            }
            //when all packet are sent, then send the ending packet
            socket.send(packet_array[packet_array.length - 1]);
            socket.close();
        }
        catch(Exception e) {
            return;
        }
    }

    public static void main(String[] args) throws Exception {
        if(args.length < 4) {
            System.out.println("Argument is invalid");
            return;
        }
        //file to send
        String file_name = args[0];
        //server port for udp
        int receiver_port = Integer.parseInt(args[1]);
        //packet count to be sent at once
        int wnd_size = Integer.parseInt(args[2]);
        //interval to be sent the window again
        int retrans_interval = Integer.parseInt(args[3]);
        
        //read file
        FileInputStream is;
        try {
            is = new FileInputStream(file_name);
        }
        catch(IOException e) {
            System.out.println("Sending File not Found");
            return;
        }
        int file_size = is.available();
        //calculate the packet count
        int packet_count = (file_size - 1) / packet_data_size + 2;
        System.out.printf("File Size = %s\n", file_size);
        System.out.printf("Window Size = %s\n", wnd_size);
        System.out.printf("Retransmission = %d\n", retrans_interval);

        InetAddress ip = InetAddress.getByName("127.0.0.1");//InetAddress.getLocalHost(); 
        
        DatagramPacket[] packet_list = new DatagramPacket[packet_count];

        byte[] packet = new byte[packet_size];
        
        for(int i = 1;i < packet_count;i ++) {
            //make packet
            int remain_size = is.available();
            int read_size = Math.min(remain_size, packet_data_size);
            byte[] data = is.readNBytes(read_size);
            //make header using big endian
            packet[0] = (byte)(i>>8);
            packet[1] = (byte)(i);
            //set packet data
            for(int j = 0; j < data.length;j ++) {
                packet[j+2] = data[j];
            }
            //make udp packet
            packet_list[i-1] = new DatagramPacket(packet, packet_size, ip, receiver_port);
            packet = new byte[packet_size];
        }
        //make last packet as ending packet
        packet[0] = 0;
        packet[1] = 0;
        packet_list[packet_count - 1] = new DatagramPacket(packet, packet_size, ip, receiver_port);
        //start sending
        Sender ack_thread = new Sender(packet_list, wnd_size, retrans_interval);
        Thread thread = new Thread(ack_thread);
        thread.start();
    }
}
