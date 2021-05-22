#include "FriendSearcher.h"
#pragma comment(lib,"ws2_32.lib") //Winsock Library
#define PORT 8888	//The port on which to listen for incoming data
#define BUFLEN 512	//Max length of buffer

DWORD WINAPI FriendSearcher::rcvThread(LPVOID lParam)
{
	printf("rcvThread created\n");

	FriendSearcher* searcher = (FriendSearcher*)lParam;
	int slen, recv_len;
	char buf[BUFLEN];
	struct sockaddr_in sent_addr;
	slen = sizeof(sent_addr);

	while(true) 
	{
		//clear the buffer by filling null, it might have previously received data
		memset(buf, '\0', BUFLEN);

		//try to receive some data, this is a blocking call
		if ((recv_len = recvfrom(searcher->m_udp_socket, buf, BUFLEN, 0, (struct sockaddr*)&sent_addr, &slen)) == SOCKET_ERROR)
		{
			printf("recvfrom() failed with error code : %d", WSAGetLastError());
			exit(EXIT_FAILURE);
		}

		//print details of the client/peer and the data received
		char ip_addr[20];
		if (sent_addr.sin_family == AF_INET) 
		{
			inet_ntop(AF_INET, &(((struct sockaddr_in*)&sent_addr)->sin_addr), ip_addr, sizeof(ip_addr));
		}
		else
		{
			inet_ntop(AF_INET6, &(((struct sockaddr_in6*)&sent_addr)->sin6_addr), ip_addr, sizeof(ip_addr));
		}
		printf("Received packet from %s:%d\n", ip_addr, ntohs(sent_addr.sin_port));
		printf("Data: %s\n", buf);
	}

	return 0;
}

DWORD WINAPI FriendSearcher::pingThread(LPVOID lParam)
{
	printf("pingThread created\n");
	FriendSearcher* searcher = (FriendSearcher*)lParam;
	do 
	{
		searcher->broadcastPing();
		Sleep(1000);
	} while (true);
}

void FriendSearcher::InitServerSocket()
{
	WSADATA wsa;
	//Initialise winsock
	printf("\nInitialising Winsock...");
	if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0)
	{
		printf("Failed. Error Code : %d", WSAGetLastError());
		exit(EXIT_FAILURE);
	}
	printf("Initialised.\n");

	
	//Create a socket
	if ((m_udp_socket = socket(AF_INET, SOCK_DGRAM, 0)) == INVALID_SOCKET)
	{
		printf("Could not create socket : %d", WSAGetLastError());
	}
	printf("Socket created.\n");

	
	sockaddr_in server;
	//Prepare the sockaddr_in structure
	server.sin_family = AF_INET;
	server.sin_addr.s_addr = INADDR_ANY;
	server.sin_port = htons(PORT);
	//Bind
	if (bind(m_udp_socket, (struct sockaddr*)&server, sizeof(server)) == SOCKET_ERROR)
	{
		printf("Bind failed with error code : %d", WSAGetLastError());
		exit(EXIT_FAILURE);
	}
	puts("Bind done");
	

	char broadcast = '1';
	setsockopt(m_udp_socket, SOL_SOCKET, SO_BROADCAST, &broadcast, sizeof(broadcast));
	
	//Prepare the sockaddr_in structure
	m_broadcast_addr.sin_family = AF_INET;
	m_broadcast_addr.sin_addr.s_addr = INADDR_BROADCAST;
	m_broadcast_addr.sin_port = htons(PORT);

	m_rcv_thread = CreateThread(NULL, 0, rcvThread, this, 0, NULL);
	m_ping_thread = CreateThread(NULL, 0, pingThread, this, 0, NULL);
}

void FriendSearcher::broadcastPing()
{
	string str = "ping:" + m_user_name;
	broadcast(str);
}

FriendSearcher::FriendSearcher(string user_name)
{
	m_user_name = user_name;
	InitServerSocket();
}

void FriendSearcher::setUserName(string use_name)
{
	m_user_name = use_name;
}

void FriendSearcher::broadcast(string data)
{
	sendData(m_broadcast_addr, (char*)data.c_str(), data.length() + 1);
}

void FriendSearcher::sendData(sockaddr_in& dst_addr, char* buffer, int len)
{
	if(sendto(m_udp_socket, buffer, len, 0, (struct sockaddr*)&dst_addr, sizeof(dst_addr)) == SOCKET_ERROR)
	{
		printf("sendto() failed with error code : %d", WSAGetLastError());
		exit(EXIT_FAILURE);
	}
}

FriendSearcher::~FriendSearcher()
{
	closesocket(m_udp_socket);
	TerminateThread(m_rcv_thread, 0);
	WSACleanup();
}
