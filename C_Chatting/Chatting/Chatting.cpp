/*
	Simple UDP Server
*/

#include<stdio.h>
#include "FriendSearcher.h"



int main()
{


	FriendSearcher seacher("Hitman");
	printf("Input string to send\n");
	//keep listening for data
	string buffer;
	while (1)
	{
		cin >> buffer;
		if (buffer == "quit") 
		{
			break;
		}
		seacher.broadcast(buffer);
		//printf("Waiting for data...");
//		fflush(stdout);

		

		
	}

	//WaitForSingleObject()

	return 0;
}