#pragma once
#include<winsock2.h>
#include <ws2tcpip.h>
#include <iostream>
using namespace std;
class FriendSearcher
{
	SOCKET m_udp_socket;
	string m_user_name;
	HANDLE m_rcv_thread;
	HANDLE m_ping_thread;

	static DWORD WINAPI rcvThread(LPVOID lParam);
	static DWORD WINAPI pingThread(LPVOID lParam);

	void InitServerSocket();

	sockaddr_in m_broadcast_addr;

	void broadcastPing();

public:
	FriendSearcher(string user_name);
	void setUserName(string use_name);
	void broadcast(string data);
	void sendData(sockaddr_in& dst_addr, char* buffer, int len);
	~FriendSearcher();
};

