###
# Run as following:
# `python3 scrape.py -f 0 -s EURUSD -m 50000 -t GMT-12:00`
# __  -d : the directory where you wanna to scan files
# __  -c : the output file name which you are going to make that contain the result of scanning
###


import os
import csv
import requests
from time import timezone

import argparse
import time

ap = argparse.ArgumentParser()
ap.add_argument('-f', '--format', type=int,
                help="the name of the output file format(Forex Strategy Builder (CSV), Expert Advisor Studio (JSON),MetaTrader (CSV),Excel (CSV)")
ap.add_argument('-s', '--symbol', type=str,
                help="the name of the symbol to display")
ap.add_argument('-m', '--maxbars', type=str,
                help="the name of the max bars to dislpay")
ap.add_argument('-t', '--timezone', type=str,
                help="the name of the timezone to display")


args = vars(ap.parse_args())

def downloadForexData(symbol_str):
    period_arr = ['1', '5', '15', '30']
    site_url = 'https://data.forexsb.com/';
    ext = '.gz'
    #https://data.forexsb.com/EURUSD1.gz
    for period in period_arr:
        file_name = symbol_str + period;
        download_url = site_url + file_name + '.gz';
        #print(download_url);
        print('Downloading  ' + file_name );
        res = requests.get(download_url);
        if(res.status_code == 200):
            text_len = len(res.text);
            print('Downloading finished: Size = %dKB' %(text_len/1024) );
            with open(file_name +'.json', "w") as f:
                f.write(res.text);
                f.close();
        else:
            print('Downloading failed');

if __name__ == "__main__":
    
    symbol_str = args['symbol']
    format = args['format']
    maxbars = args['maxbars']
    tz_str = args['timezone']
       
    is_ok = True;
    if format == None:
        is_ok = False;
        format = 0;
    if symbol_str == None:
        is_ok = False;
        symbol_str = 'EURUSD';
    if maxbars == None:
        is_ok = False;
        maxbars = 50000;
    if tz_str == None:
        is_ok = False;
        tz_str = 'GMT-12:00';
    if(is_ok == False):
        print('Input paramters are invalid\t execute program using default parameters\n')
    
    downloadForexData(symbol_str)
    
