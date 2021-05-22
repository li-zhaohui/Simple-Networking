###
# Run as following:
# `python3 scrape.py -f 0 -s EURUSD -m 50000 -t GMT-12:00`
# __  -d : the directory where you wanna to scan files
# __  -c : the output file name which you are going to make that contain the result of scanning
###


import os
import csv
import requests
import time
from time import timezone
from datetime import datetime
import pytz
import math
from enum import Enum
import json
import argparse
import sys


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

class DataPeriod:
    dataPeriod_Int = [1, 5, 15, 30, 60, 240, 1440, 10080, 43200]
    dataPeriod_Str = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1']
class ExpressFormat:
    format = ['fsbProCsv','eaStudioJson','metaTraderCsv','excelCsv']
    
class DataId:
    def __init__(self):
        self.source = 'Premium Data';
        self.symbol = 'EURUSD';
        self.period = 30;

    @staticmethod
    def create(source, symbol, period):
        dataId = {}
        dataId['source'] = source;
        dataId['symbol'] = symbol;
        dataId['period'] = period;
        return dataId;
    def clone(self):
        dataId = DataId();
        dataId.source = self.source;
        dataId.symbol = self.symbol;
        dataId.period = self.period;
        return dataId;
    
class DataBar:
    def __init__(self):
        self.time = 0;
        self.open = 0;
        self.high = - sys.maxsize * 2;
        self.low =  + sys.maxsize * 2 + 1;
        self.close = 0;
        self.volume = 0;
    @staticmethod
    def barTimeToString(ts):
        #const toString = (n) => n < 10 ? '0' + n : '' + n;
        date = datetime.fromtimestamp(ts / 1000.0, pytz.utc);
        return date.strftime("%Y-%m-%d %H:%M")
    
class DataSet:
    
    def __init__(self) :
        self.ver = 0;
        self.dataId = DataId.create('Premium Data', 'EURUSD', 30);
        self.terminal = '';
        self.company = '';
        self.server = '';
        self.symbol = '';
        self.period = 4;
        self.baseCurrency = '';
        self.priceIn = '';
        self.lotSize = 0;
        self.stopLevel = 0;
        self.tickValue = 0;
        self.minLot = 0;
        self.maxLot = 0;
        self.lotStep = 0;
        self.spread = 0;
        self.point = 0;
        self.digits = 0;
        self.bars = 0;
        self.swapLong = 0;
        self.swapShort = 0;
        self.swapThreeDays = 5;#DayOfWeek.Friday;
        self.swapType = 0;#SwapType.Point;
        self.swapMode = 1;#SwapMode.Points;
        self.commission = 0;
        self.timezoneShift = 0;
        self.time = [];
        self.open = [];
        self.high = [];
        self.low = [];
        self.close = [];
        self.volume = [];
    
    def clone(self):
        dataSet = self.copyParams();
        dataSet.bars = self.bars;
        dataSet.time = self.time;
        dataSet.open = self.open;
        dataSet.high = self.high;
        dataSet.low = self.low;
        dataSet.close = self.close;
        dataSet.volume = self.volume;
        return dataSet;
    
    def copyParams(self) :
        dataSet = DataSet();
        dataSet.ver = self.ver;
        dataSet.dataId = self.dataId;
        dataSet.terminal = self.terminal;
        dataSet.company = self.company;
        dataSet.server = self.server;
        dataSet.symbol = self.symbol;
        dataSet.period = self.period;
        dataSet.baseCurrency = self.baseCurrency;
        dataSet.priceIn = self.priceIn;
        dataSet.lotSize = self.lotSize;
        dataSet.stopLevel = self.stopLevel;
        dataSet.tickValue = self.tickValue;
        dataSet.minLot = self.minLot;
        dataSet.maxLot = self.maxLot;
        dataSet.lotStep = self.lotStep;
        dataSet.spread = self.spread;
        dataSet.digits = self.digits;
        dataSet.point = self.point;
        dataSet.swapLong = self.swapLong;
        dataSet.swapShort = self.swapShort;
        dataSet.swapType = self.swapType;
        dataSet.swapMode = self.swapMode;
        dataSet.swapThreeDays = self.swapThreeDays;
        dataSet.commission = self.commission;
        dataSet.timezoneShift = self.timezoneShift;
        return dataSet;
    @staticmethod
    def getBaseCurrency(symbol):
        if len(symbol) == 6 and symbol.upper() == symbol:
            return symbol[0:3]
        else:
            return symbol
    @staticmethod
    def getPriceIn(symbol):
        if len(symbol) == 6 and symbol.upper() == symbol:
            return symbol[3:6]
        else:
            return 'USD'
    @staticmethod
    def deserialize(data):
        millennium = pytz.utc.localize(datetime(2000, 1, 1)).timestamp() * 1000
        dataSet = DataSet();
        if isinstance(data['ver'], int) == True:
            dataSet.ver = data['ver'];
        
        dataSet.dataId = DataId.create(data['server'], data['symbol'], data['period']);
        dataSet.terminal = data['terminal'];
        dataSet.company = data['company'];
        dataSet.server = data['server'];
        dataSet.symbol = data['symbol'];
        dataSet.period = data['period'];
        if 'baseCurrency' in data:
            dataSet.baseCurrency = data['baseCurrency'];
        else:
            dataSet.baseCurrency = DataSet.getBaseCurrency(dataSet.symbol)
        if 'priceIn' in data:
            dataSet.priceIn = data['priceIn'];
        else:
            dataSet.priceIn = DataSet.getPriceIn(dataSet.symbol)
        if 'lotSize' in data:
            dataSet.lotSize = data['lotSize'];
        else:
            dataSet.lotSize = 100000
        if 'stopLevel' in data:
            dataSet.stopLevel = data['stopLevel'];
        else:
            dataSet.stopLevel = 0;
        if 'tickValue' in data:
            dataSet.tickValue = data['tickValue'];
        else:
            dataSet.tickValue = 0;
        if 'minLot' in data:
            dataSet.minLot = data['minLot'];
        else:
            dataSet.minLot = 0.01;
        if 'maxLot' in data:
            dataSet.maxLot = data['maxLot'];
        else:
            dataSet.maxLot = 1000.0
        if 'lotStep' in data:
            dataSet.lotStep = data['lotStep'];
        else :
            dataSet.lotStep = 0.01
        if 'spread' in data:
            dataSet.spread = data['spread'];
        else:
            dataSet.spread = 10;
        if 'digits' in data:
            dataSet.digits = data['digits'];
        else:
            dataSet.digits = 5;
        if 'point' in data:
            dataSet.point = math.round(math.pow(10, -dataSet.digits)*10000)/10000;
        else:
            dataSet.point = 0.00001
        if 'swapLong' in data:
            dataSet.swapLong = data['swapLong'];
        else:
            dataSet.swapLong = -2.0;
        if 'swapShort' in data:
            dataSet.swapShort = data['swapShort'];
        else:
            dataSet.swapShort = -2.0
        if 'commission' in data:
            dataSet.commission = abs(data['commission']);
        else:
            dataSet.commission = 0.0;
        if 'swapType' in data:
            dataSet.swapType = data['swapType'];
        else:
            dataSet.swapType = 0;
        if 'swapMode' in data:
            dataSet.swapMode = data['swapMode'];
        else:
            dataSet.swapMode = 1;
        if 'swapThreeDays' in data:
            dataSet.swapThreeDays = data['swapThreeDays'];
        else:
            dataSet.swapThreeDays = 5;#Friday
            
        dataSet.bars = len(data['time']);
        dataSet.time = [];
        dataSet.volume = [];
        for bar in range(dataSet.bars):
            dataSet.time.append(data['time'][bar] * 60000 + millennium);
            dataSet.volume.append(math.ceil(data['volume'][bar]));

        dataSet.open = data['open']#.slice();
        dataSet.high = data['high']#.slice();
        dataSet.low = data['low']#.slice();
        dataSet.close = data['close']#.slice();
        return dataSet
    @staticmethod
    def cutDataSet(dataSet, maxBars):
        
        output = dataSet.copyParams();
        output.time = dataSet.time[-maxBars:]; 
        output.open = dataSet.open[-maxBars:];
        output.high = dataSet.high[-maxBars:];
        output.low = dataSet.low[-maxBars:];
        output.close = dataSet.close[-maxBars:];
        output.volume = dataSet.volume[-maxBars:];
        output.bars = len(output.time);
        return output;    
    def applyTimezoneShift(self, tzShift):
        shift = tzShift * 60 * 60 * 1000
        for bar in range(self.bars):
            self.time[bar] += shift
    
    def generateLtfBars(self, period):
        ltfDataSet = DataSet();
        ltfDataSet.dataId = DataId.create(self.server, self.symbol, period);
        ltfDataSet.terminal = self.terminal;
        ltfDataSet.company = self.company;
        ltfDataSet.server = self.server;
        ltfDataSet.symbol = self.symbol;
        ltfDataSet.period = period;
        ltfDataSet.baseCurrency = self.baseCurrency;
        ltfDataSet.priceIn = self.priceIn;
        ltfDataSet.lotSize = self.lotSize;
        ltfDataSet.stopLevel = self.stopLevel;
        ltfDataSet.tickValue = self.tickValue;
        ltfDataSet.minLot = self.minLot;
        ltfDataSet.maxLot = self.maxLot;
        ltfDataSet.lotStep = self.lotStep;
        ltfDataSet.spread = self.spread;
        ltfDataSet.digits = self.digits;
        ltfDataSet.point = self.point;
        ltfDataSet.swapLong = self.swapLong;
        ltfDataSet.swapShort = self.swapShort;
        ltfDataSet.commission = self.commission;
        ltfDataSet.swapType = self.swapType;
        ltfDataSet.swapMode = self.swapMode;
        ltfDataSet.swapThreeDays = self.swapThreeDays;

        ltfBar = DataBar();
        for i in range(self.bars):
            
            time = self.time[i] - self.time[i] % (period * 60000);
            
            if (time > ltfBar.time and ltfBar.volume > 0):
                ltfDataSet.addBar(ltfBar);
                ltfBar = DataBar();
            
            if (ltfBar.volume ==0) :
                ltfBar.time = time;
                ltfBar.open = self.open[i];
            
            if (ltfBar.high < self.high[i]):
                ltfBar.high = self.high[i];
            
            if (ltfBar.low > self.low[i]):
                ltfBar.low = self.low[i];
            
            ltfBar.close = self.close[i];
            ltfBar.volume += self.volume[i];
            
        if (ltfBar.volume > 0):
            ltfDataSet.addBar(ltfBar);
            
        ltfDataSet.bars = len(ltfDataSet.time);
        return ltfDataSet;
    def addBar(self, bar):
        self.time.append(bar.time);
        self.open.append(bar.open);
        self.high.append(bar.high);
        self.low.append(bar.low);
        self.close.append(bar.close);
        self.volume.append(bar.volume);
class Settings:
    def __init__(self):
        self.selectedSymbol = 'EURUSD';
        self.selectedPeriod = 4;
        self.exportFormat = 0;
        self.maxBars = 50000;
        self.timezoneIndex = '80000050';
        self.filenamePrefix = '';
        self.filenameSuffix = '';
        self.serverName = 'Premium Data';
class ForexManager:
    download_period = [1, 5, 15, 30]
    url = 'https://data.forexsb.com/'
    ext = '.gz'
    dataset_origin = []
    settings = Settings();
    def __init__(self, symbol = None):

        self.symbol = symbol;
        if symbol == None:
            self.symbol = 'EURUSD';
    def download(self):
        b_is_finished = True;
        print('Downloading  started');
        for period in self.download_period:

            file_name = symbol_str + str(period);
            download_url = self.url + file_name + self.ext;
            print('\t' + file_name);

#            with open(file_name +'.json', "r") as f:
##                dataSet = DataSet.deserialize(json.loads(f.read()))
 #               self.dataset_origin.append(dataSet)
 #               f.close();
 #           continue

            res = requests.get(download_url);
            if(res.status_code == 200):
                text_len = len(res.text);
                self.data_origin.append(json.loads(res.text))
                
                print('\tSize = %dKB' %(text_len/1024) );
                with open(file_name +'.json', "w") as f:
                    f.write(res.text);
                    f.close();
            else:
                self.data_origin.append(None)
                b_is_finished = False;
                print('\tfailed');
        print('Download finished\n');
        return b_is_finished;
    def applyTimezoneShift(self, tzShift):
        for idx in range(len(self.dataset_origin)):
            self.dataset_origin[idx].applyTimezoneShift(tzShift)

    def getExportFileName(self, format, period):
        out_ext = ".csv";
        if format == 1:
            out_ext = ".json";
        out_file_name = self.symbol +"_"+DataPeriod.dataPeriod_Str[period]+out_ext;
        return out_file_name

    def export(self, maxBars, tz_str, format):
        local_tz = pytz.timezone(tz_str)
        utc_offset = local_tz.utcoffset( datetime.now()).total_seconds()
        tzShift = utc_offset/60 / 60

        self.applyTimezoneShift(-tzShift)
        
        exportFunctions = [
            ForexManager.composeFsbProCsv,
            ForexManager.composeEaStudioJson,
            ForexManager.composeMetaTraderCsv,
            ForexManager.composeExcelCls,
        ];
        print('Export started')
        for idx in range(len(DataPeriod.dataPeriod_Int)):
            out_dataset = None
            if idx >= len(ForexManager.download_period):
                out_dataset = self.dataset_origin[3].generateLtfBars(idx)
            else:
                out_dataset = self.dataset_origin[idx]

            new_dataset = DataSet.cutDataSet(out_dataset, maxBars)
            export_text = exportFunctions[format](new_dataset);
            with open(self.getExportFileName(format, idx), "w") as f:
                f.write(export_text)
                f.close()
                break
        print('Export finished')       
            
    @staticmethod    
    def composeFsbProCsv(dataSet):
        textList = []

        for bar in range(dataSet.bars):
            textList.append(DataBar.barTimeToString(dataSet.time[bar]) + '\t' +
                '{:.{prec}f}'.format(dataSet.open[bar], prec = dataSet.digits) + '\t' +
                '{:.{prec}f}'.format(dataSet.high[bar], prec = dataSet.digits) + '\t' +
                '{:.{prec}f}'.format(dataSet.low[bar], prec = dataSet.digits) + '\t' +
                '{:.{prec}f}'.format(dataSet.close[bar], prec = dataSet.digits) + '\t' +
                str(dataSet.volume[bar]))
        return '\n'.join(textList);
    @staticmethod    
    def composeEaStudioJson(dataSet) :
        millennium = pytz.utc.localize(datetime(2000, 1, 1)).timestamp() * 1000;
        exportDto = dataSet.clone();
        exportDto.server = ForexManager.settings.serverName;
        exportDto.ver = 3;
        for bar in range(dataSet.bars):
            exportDto.time[bar] = (exportDto.time[bar] - millennium) / 60000;
        
        return json.dumps(exportDto.__dict__);
    
    @staticmethod  
    def composeMetaTraderCsv(dataSet):

        textList = [];
        for bar in range(dataSet.bars):
            textList.append(DataBar.barTimeToString(dataSet.time[bar]) + ',' +
                str(dataSet.open[bar]) + ',' +
                str(dataSet.high[bar]) + ',' +
                str(dataSet.low[bar]) + ',' +
                str(dataSet.close[bar]) + ',' +
                str(dataSet.volume[bar]));

        return '\n'.join(textList);
    
    @staticmethod
    def composeExcelCls(dataSet):
        textList = ['Time\tOpen\tHigh\tLow\tClose\tVolume'];
        for bar in range(dataSet.bars):
            textList.append(DataBar.barTimeToString(dataSet.time[bar]) + ':00' + '\t' +
                str(dataSet.open[bar]) + '\t' +
                str(dataSet.high[bar]) + '\t' +
                str(dataSet.low[bar]) + '\t' +
                str(dataSet.close[bar]) + '\t' +
                str(dataSet.volume[bar]));
        
        return '\n'.join(textList);
   
    
def downloadData(symbol_str,  maxbars, tz_str, format):
    mgr = ForexManager(symbol_str);
    if mgr.download() == True:
        mgr.export(maxbars, tz_str, format)

if __name__ == "__main__":
    
    symbol_str = args['symbol']
    format = args['format']
    maxbars = args['maxbars']
    tz_str = args['timezone']
    
    is_ok = True;
    if format == None:
        is_ok = False;
        format = 1;
    if symbol_str == None:
        is_ok = False;
        symbol_str = 'EURUSD';
    if maxbars == None or maxbars > 200000:
        is_ok = False;
        maxbars = 5000;
        print('MaxBars is incorrect\n')
    if tz_str == None or tz_str in pytz.all_timezones == False:
        is_ok = False;
        tz_str = 'Europe/London';
        print('Timezone is incorrect\n')
    if(is_ok == False):
        print('Input paramters are invalid\t execute program using default parameters\n')
    
    downloadData(symbol_str,  maxbars, tz_str, format)
