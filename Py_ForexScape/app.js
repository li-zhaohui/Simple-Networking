'use strict';
let app;
class Application {
    constructor(appViewModel) {
        this.appViewModel = appViewModel;
        this.timezones = TimezoneModel.timezones;
        this.dataManager = new DataManager();
        this.exportManager = new ExportManager();
        this.settings = new Settings();
    }
    initialize() {
        this.loadSettings();
    }
    closeApp() {
        this.saveSettings();
    }
    getDataId(period = app.settings.selectedPeriod) {
        return DataId.create(app.settings.serverName, app.settings.selectedSymbol, period);
    }
    loadSettings() {
        const settingsDto = IoService.getItemFromLocalStorage('data-app-settings');
        if (typeof settingsDto === 'object' && settingsDto !== null) {
            this.settings = Settings.deserialize(settingsDto);
        }
    }
    saveSettings() {
        IoService.setItemToLocalStorage('data-app-settings', this.settings.serialize());
    }
}
class DataHelper {
    static fixDataSettings(dto) {
        dto.baseCurrency = (typeof dto.baseCurrency === 'string') ? dto.baseCurrency : DataHelper.getBaseCurrency(dto.symbol);
        dto.priceIn = (typeof dto.priceIn === 'string') ? dto.priceIn : DataHelper.getPriceIn(dto.symbol);
        dto.stopLevel = (typeof dto.stopLevel === 'number') ? dto.stopLevel : 0;
        dto.tickValue = (typeof dto.tickValue === 'number') ? dto.tickValue : 1;
        dto.minLot = (typeof dto.minLot === 'number') ? dto.minLot : 0.01;
        dto.maxLot = (typeof dto.maxLot === 'number') ? dto.maxLot : 1000.0;
        dto.lotStep = (typeof dto.lotStep === 'number') ? dto.lotStep : 0.01;
        dto.spread = (typeof dto.spread === 'number') ? dto.spread : 10;
        dto.swapThreeDays = (typeof dto.swapThreeDays === 'number') ? dto.swapThreeDays : DayOfWeek.Friday;
        dto.swapLong = (typeof dto.swapLong === 'number') ? dto.swapLong : -2.0;
        dto.swapShort = (typeof dto.swapShort === 'number') ? dto.swapShort : -2.0;
        dto.commission = (typeof dto.commission === 'number') ? Math.abs(dto.commission) : 0.0;
        dto.lotSize = (typeof dto.lotSize === 'number') ? dto.lotSize : 100000;
        dto.digits = (typeof dto.digits === 'number') ? dto.digits : 5;
        dto.point = Math.round(Math.pow(10, -dto.digits) * 100000) / 100000;
        if ((typeof dto.swapType !== 'number') && (typeof dto.swapMode !== 'number')) {
            dto.swapType = SwapType.Point;
            dto.swapMode = SwapMode.Points;
        }
        else if (typeof dto.swapType !== 'number') {
            dto.swapType = DataHelper.getSwapType(dto.swapMode);
        }
        else if (typeof dto.swapMode !== 'number') {
            dto.swapMode = DataHelper.getSwapMode(dto.swapType);
        }
    }
    static deserializeDataSet(data) {
        const millennium = Date.UTC(2000, 0, 1);
        const dataSet = new DataSet();
        if (typeof data.ver === 'number') {
            dataSet.ver = data.ver;
        }
        dataSet.dataId = DataId.create(data.server, data.symbol, data.period);
        dataSet.terminal = data.terminal;
        dataSet.company = data.company;
        dataSet.server = data.server;
        dataSet.symbol = data.symbol;
        dataSet.period = data.period;
        dataSet.baseCurrency = data.baseCurrency;
        dataSet.priceIn = data.priceIn;
        dataSet.lotSize = data.lotSize;
        dataSet.stopLevel = data.stopLevel;
        dataSet.tickValue = data.tickValue;
        dataSet.minLot = data.minLot;
        dataSet.maxLot = data.maxLot;
        dataSet.lotStep = data.lotStep;
        dataSet.spread = data.spread;
        dataSet.digits = data.digits;
        dataSet.point = data.point;
        dataSet.swapLong = data.swapLong;
        dataSet.swapShort = data.swapShort;
        dataSet.commission = data.commission;
        dataSet.swapType = data.swapType;
        dataSet.swapMode = data.swapMode;
        dataSet.swapThreeDays = data.swapThreeDays;
        dataSet.bars = data.time.length;
        dataSet.time = new Array(dataSet.bars);
        dataSet.volume = new Array(dataSet.bars);
        for (let bar = 0; bar < dataSet.bars; bar++) {
            dataSet.time[bar] = data.time[bar] * 60000 + millennium;
            dataSet.volume[bar] = Math.ceil(data.volume[bar]);
        }
        dataSet.open = data.open.slice();
        dataSet.high = data.high.slice();
        dataSet.low = data.low.slice();
        dataSet.close = data.close.slice();
        return dataSet;
    }
    static getBaseCurrency(symbol) {
        return (symbol.length === 6 && symbol.toUpperCase() === symbol)
            ? symbol.substring(0, 3)
            : symbol;
    }
    static getPriceIn(symbol) {
        return (symbol.length === 6 && symbol.toUpperCase() === symbol)
            ? symbol.substring(3, 6)
            : 'USD';
    }
    static getSwapType(swapMode) {
        switch (swapMode) {
            case SwapMode.Disabled:
            case SwapMode.Points:
            case SwapMode.ReopenCurrent:
            case SwapMode.ReopenBid:
                return SwapType.Point;
            case SwapMode.CurrencySymbol:
            case SwapMode.CurrencyDeposit:
                return SwapType.BaseCurrency;
            case SwapMode.CurrencyMargin:
                return SwapType.MarginCurrency;
            case SwapMode.InterestCurrent:
            case SwapMode.InterestOpen:
                return SwapType.InterestRate;
        }
    }
    static getSwapMode(swapType) {
        switch (swapType) {
            case SwapType.Point:
                return SwapMode.Points;
            case SwapType.BaseCurrency:
                return SwapMode.CurrencySymbol;
            case SwapType.MarginCurrency:
                return SwapMode.CurrencyMargin;
            case SwapType.InterestRate:
                return SwapMode.InterestOpen;
        }
    }
    static getDataFile(dataId) {
        const encodedSymbol = dataId.symbol.replace(/#/g, '%23');
        return `/${encodedSymbol}${dataId.period}.gz`;
    }
    static cutDataSet(dataSet, maxBars) {
        const output = dataSet.copyParams();
        output.time = dataSet.time.slice(-maxBars);
        output.open = dataSet.open.slice(-maxBars);
        output.high = dataSet.high.slice(-maxBars);
        output.low = dataSet.low.slice(-maxBars);
        output.close = dataSet.close.slice(-maxBars);
        output.volume = dataSet.volume.slice(-maxBars);
        output.bars = output.time.length;
        return output;
    }
    static barTimeToString(time) {
        const toString = (n) => n < 10 ? '0' + n : '' + n;
        const date = new Date(time);
        return '' +
            date.getUTCFullYear() + '-' +
            toString(date.getUTCMonth() + 1) + '-' +
            toString(date.getUTCDate()) + ' ' +
            toString(date.getUTCHours()) + ':' +
            toString(date.getUTCMinutes());
    }
    static generateLtfBars(dataSet, period) {
        const ltfDataSet = new DataSet();
        ltfDataSet.dataId = DataId.create(dataSet.server, dataSet.symbol, period);
        ltfDataSet.terminal = dataSet.terminal;
        ltfDataSet.company = dataSet.company;
        ltfDataSet.server = dataSet.server;
        ltfDataSet.symbol = dataSet.symbol;
        ltfDataSet.period = period;
        ltfDataSet.baseCurrency = dataSet.baseCurrency;
        ltfDataSet.priceIn = dataSet.priceIn;
        ltfDataSet.lotSize = dataSet.lotSize;
        ltfDataSet.stopLevel = dataSet.stopLevel;
        ltfDataSet.tickValue = dataSet.tickValue;
        ltfDataSet.minLot = dataSet.minLot;
        ltfDataSet.maxLot = dataSet.maxLot;
        ltfDataSet.lotStep = dataSet.lotStep;
        ltfDataSet.spread = dataSet.spread;
        ltfDataSet.digits = dataSet.digits;
        ltfDataSet.point = dataSet.point;
        ltfDataSet.swapLong = dataSet.swapLong;
        ltfDataSet.swapShort = dataSet.swapShort;
        ltfDataSet.commission = dataSet.commission;
        ltfDataSet.swapType = dataSet.swapType;
        ltfDataSet.swapMode = dataSet.swapMode;
        ltfDataSet.swapThreeDays = dataSet.swapThreeDays;
        const setBar = (bar) => {
            ltfDataSet.time.push(bar.time);
            ltfDataSet.open.push(bar.open);
            ltfDataSet.high.push(bar.high);
            ltfDataSet.low.push(bar.low);
            ltfDataSet.close.push(bar.close);
            ltfDataSet.volume.push(bar.volume);
        };
        let ltfBar = new DataBar();
        for (let i = 0; i < dataSet.bars; i++) {
            const time = dataSet.time[i] - dataSet.time[i] % (period * 60000);
            if (time > ltfBar.time && ltfBar.volume > 0) {
                setBar(ltfBar);
                ltfBar = new DataBar();
            }
            if (ltfBar.volume === 0) {
                ltfBar.time = time;
                ltfBar.open = dataSet.open[i];
            }
            if (ltfBar.high < dataSet.high[i]) {
                ltfBar.high = dataSet.high[i];
            }
            if (ltfBar.low > dataSet.low[i]) {
                ltfBar.low = dataSet.low[i];
            }
            ltfBar.close = dataSet.close[i];
            ltfBar.volume += dataSet.volume[i];
        }
        if (ltfBar.volume > 0) {
            setBar(ltfBar);
        }
        ltfDataSet.bars = ltfDataSet.time.length;
        return ltfDataSet;
    }
}
class DataManager {
    constructor() {
        this.dataHolder = {};
        this.waitingList = [];
    }
    getData(dataId) {
        return this.dataHolder[dataId.dataKey];
    }
    loadData(dataId, callback) {
        if (this.waitingList.indexOf(dataId.dataKey) >= 0) {
            return;
        }
        if (Object.keys(this.dataHolder).indexOf(dataId.dataKey) >= 0) {
            callback(this.dataHolder[dataId.dataKey]);
            return;
        }
        this.waitingList.push(dataId.dataKey);
        const dataFilePath = DataHelper.getDataFile(dataId);
        IoService.getData(dataFilePath, this.ioService_getData_ready.bind(this, callback, dataId));
    }
    applyTimezoneShift(dataId, tzShift) {
        const shift = tzShift * 60 * 60 * 1000;
        const dataSet = this.dataHolder[dataId.dataKey];
        for (let bar = 0; bar < dataSet.bars; bar++) {
            dataSet.time[bar] += shift;
        }
    }
    setData(dataSet) {
        this.dataHolder[dataSet.dataId.dataKey] = dataSet;
    }
    releaseDataFiles() {
        this.waitingList = [];
        this.dataHolder = {};
    }
    getBarData(dataId, bar) {
        const dataSet = this.dataHolder[dataId.dataKey];
        if (typeof dataSet === 'object' && typeof dataSet.bars === 'number') {
            if (0 <= bar && bar < dataSet.bars) {
                return {
                    digits: dataSet.digits,
                    bar: bar,
                    time: dataSet.time[bar],
                    open: dataSet.open[bar],
                    high: dataSet.high[bar],
                    low: dataSet.low[bar],
                    close: dataSet.close[bar],
                    volume: dataSet.volume[bar],
                };
            }
        }
        return null;
    }
    getDataSetLength(dataId) {
        return this.dataHolder[dataId.dataKey]
            ? this.dataHolder[dataId.dataKey].bars
            : 0;
    }
    ioService_getData_ready(callback, dataId, err, dataTextDto) {
        if (!err && dataTextDto) {
            try {
                const dataSetDto = JSON.parse(dataTextDto);
                DataHelper.fixDataSettings(dataSetDto);
                this.dataHolder[dataId.dataKey] = DataHelper.deserializeDataSet(dataSetDto);
            }
            catch (e) {
                console.error(e.message + ': ' + 'Load data file ' + dataId.toNormalizedString());
            }
        }
        const index = this.waitingList.indexOf(dataId.dataKey);
        if (index >= 0) {
            this.waitingList.splice(index, 1);
        }
        callback(this.dataHolder[dataId.dataKey]);
    }
}
class ExportManager {
    constructor() {
        this.dataHolder = {};
        this.exportFileHolder = {};
    }
    releaseDataFiles() {
        this.dataHolder = {};
        this.exportFileHolder = {};
    }
    setExportDataSet(dataSet) {
        this.dataHolder[dataSet.dataId.dataKey] = dataSet;
    }
    makeExportFile(dataId, format, callback) {
        if (!this.dataHolder[dataId.dataKey]) {
            console.error('There is no data for ' + dataId.dataKey);
        }
        const exportFunctions = [
            this.composeFsbProCsv,
            this.composeEaStudioJson,
            this.composeMetaTraderCsv,
            this.composeExcelCls,
        ];
        setTimeout(exportFunctions[format].bind(this), 0, dataId, callback);
    }
    exportFile(dataId, fileName) {
        if (typeof this.exportFileHolder[dataId.dataKey] === 'string') {
            IoService.downloadTextAsFile(fileName, this.exportFileHolder[dataId.dataKey]);
        }
    }
    composeFsbProCsv(dataId, callback) {
        const dataSet = this.dataHolder[dataId.dataKey];
        const textList = [];
        for (let bar = 0; bar < dataSet.bars; bar++) {
            textList.push(DataHelper.barTimeToString(dataSet.time[bar]) + '\t' +
                dataSet.open[bar].toFixed(dataSet.digits) + '\t' +
                dataSet.high[bar].toFixed(dataSet.digits) + '\t' +
                dataSet.low[bar].toFixed(dataSet.digits) + '\t' +
                dataSet.close[bar].toFixed(dataSet.digits) + '\t' +
                dataSet.volume[bar].toString());
        }
        this.exportFileHolder[dataId.dataKey] = textList.join('\r\n');
        callback(dataId);
    }
    composeEaStudioJson(dataId, callback) {
        const millennium = Date.UTC(2000, 0, 1);
        const dataSet = this.dataHolder[dataId.dataKey];
        const exportDto = dataSet.clone();
        exportDto.server = app.settings.serverName;
        exportDto.ver = 3;
        for (let bar = 0; bar < dataSet.bars; bar++) {
            exportDto.time[bar] = (exportDto.time[bar] - millennium) / 60000;
        }
        this.exportFileHolder[dataId.dataKey] = JSON.stringify(exportDto);
        callback(dataId);
    }
    composeMetaTraderCsv(dataId, callback) {
        const dataSet = this.dataHolder[dataId.dataKey];
        const textList = [];
        for (let bar = 0; bar < dataSet.bars; bar++) {
            textList.push(DataHelper.barTimeToString(dataSet.time[bar]) + ',' +
                dataSet.open[bar] + ',' +
                dataSet.high[bar] + ',' +
                dataSet.low[bar] + ',' +
                dataSet.close[bar] + ',' +
                dataSet.volume[bar]);
        }
        this.exportFileHolder[dataId.dataKey] = textList.join('\r\n');
        callback(dataId);
    }
    composeExcelCls(dataId, callback) {
        const dataSet = this.dataHolder[dataId.dataKey];
        const textList = ['Time\tOpen\tHigh\tLow\tClose\tVolume'];
        for (let bar = 0; bar < dataSet.bars; bar++) {
            textList.push(DataHelper.barTimeToString(dataSet.time[bar]) + ':00' + '\t' +
                dataSet.open[bar] + '\t' +
                dataSet.high[bar] + '\t' +
                dataSet.low[bar] + '\t' +
                dataSet.close[bar] + '\t' +
                dataSet.volume[bar]);
        }
        this.exportFileHolder[dataId.dataKey] = textList.join('\r\n');
        callback(dataId);
    }
}
class IndicatorChart {
    constructor(context) {
        this.chartBars = 0;
        this.chartFirstBar = 0;
        this.barWidth = 10;
        this.space = 5;
        this.scrollHeight = 5;
        this.priceChartBottomMargin = 17;
        this.sepChartPadding = 14;
        this.textHeight = 15;
        this.yTop = 0;
        this.yBottom = 0;
        this.xLeft = 0;
        this.xRight = 0;
        this.yPriceBottom = 0;
        this.chartWidth = 0;
        this.chartLastBar = 0;
        this.maxPrice = 0;
        this.minPrice = 0;
        this.maxVolume = 0;
        this.yScale = 0;
        this.yScaleVolume = 0;
        this.priceLabelWidth = 0;
        this.deltaLabel = 0;
        this.dataSet = new DataSet();
        this.startBar = 0;
        this.context = context;
    }
    draw(dataSet, startBar) {
        this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
        this.dataSet = dataSet || new DataSet();
        this.startBar = startBar;
        if (this.dataSet.bars === 0) {
            this.setBorders();
            this.drawTexts();
            this.drawAxes();
            return;
        }
        this.setBorders();
        this.setMinMaxPrice();
        this.setLabels();
        this.drawHorizontalGrid();
        this.drawMainChartVerticalGrid();
        this.drawVolumeBars();
        this.drawPriceBars();
        this.clearLabelArea();
        this.clearBelowMainChart();
        this.drawHorizontalLabels();
        this.drawLabelsAndSepChartVerticalGrid();
        this.drawTexts();
        this.drawAxes();
        this.drawScrollBar();
    }
    getBarNumberAtX(reqX) {
        if (!this.dataSet) {
            return -1;
        }
        const positionBar = this.chartFirstBar + Math.round((reqX - this.xLeft) / this.barWidth);
        return Math.max(Math.min(positionBar, this.chartFirstBar + this.chartBars, this.dataSet.bars - 1), this.chartFirstBar);
    }
    setBorders() {
        this.yTop = this.textHeight;
        this.yBottom = this.context.canvas.height - this.scrollHeight - 1;
        this.xLeft = this.space + Math.round(this.barWidth / 2) + 1;
        this.yPriceBottom = this.yBottom - this.priceChartBottomMargin - Math.round(this.sepChartPadding / 2);
        const textWith = this.context.measureText('1.99999').width;
        this.priceLabelWidth = Math.max(textWith + 10, 30);
        this.xRight = this.context.canvas.width - this.space - this.priceLabelWidth;
        this.chartWidth = this.xRight - this.xLeft;
        if (this.dataSet) {
            this.chartBars = Math.floor(this.chartWidth / this.barWidth);
            this.chartBars = Math.min(this.chartBars, this.dataSet.bars);
            this.chartFirstBar = Math.min(this.startBar, this.dataSet.bars - this.chartBars);
            this.chartLastBar = Math.max(this.chartFirstBar + this.chartBars - 1, this.chartFirstBar);
        }
    }
    setMinMaxPrice() {
        this.maxPrice = -Number.MAX_VALUE;
        this.minPrice = Number.MAX_VALUE;
        this.maxVolume = 0;
        for (let bar = this.chartFirstBar; bar <= this.chartLastBar; bar++) {
            if (this.dataSet.high[bar] > this.maxPrice) {
                this.maxPrice = this.dataSet.high[bar];
            }
            if (this.dataSet.low[bar] < this.minPrice) {
                this.minPrice = this.dataSet.low[bar];
            }
            if (this.dataSet.volume[bar] > this.maxVolume) {
                this.maxVolume = this.dataSet.volume[bar];
            }
        }
        this.minPrice -= this.dataSet.point * 10;
        this.maxPrice += this.dataSet.point * 10;
    }
    setLabels() {
        const labels = Math.max((this.yPriceBottom - this.yTop) / 30, 1);
        const deltaPoint = this.dataSet.point * (this.dataSet.digits === 3 || this.dataSet.digits === 5 ? 100 : 10);
        const digits = Math.pow(10, this.dataSet.point < 0.001 ? 3 : 1);
        this.deltaLabel = Math.max(Math.round(digits * (this.maxPrice - this.minPrice) / labels) / digits, deltaPoint);
        this.minPrice = Math.round(this.minPrice * digits) / digits - deltaPoint;
        const countLabels = Math.ceil((this.maxPrice - this.minPrice) / this.deltaLabel);
        this.maxPrice = this.minPrice + countLabels * this.deltaLabel;
        this.yScale = (this.yPriceBottom - this.yTop) / (countLabels * this.deltaLabel);
        this.yScaleVolume = this.maxVolume > 0 ? ((this.yPriceBottom - this.yTop) / 8.0) / this.maxVolume : 0.0;
    }
    moveTo(x, y) {
        this.context.moveTo(x + 0.5, y + 0.5);
    }
    lineTo(x, y) {
        this.context.lineTo(x + 0.5, y + 0.5);
    }
    strokeRect(x, y, width, height) {
        this.context.strokeRect(x + 0.5, y + 0.5, width, height);
    }
    fillRect(x, y, width, height) {
        this.context.fillRect(x + 0.5, y + 0.5, width, height);
    }
    drawHorizontalGrid() {
        this.context.beginPath();
        this.context.fillStyle = ChartColors.ForeColor;
        for (let labelPrice = this.minPrice; labelPrice <= this.maxPrice + this.dataSet.point; labelPrice += this.deltaLabel) {
            const labelY = Math.round(this.yPriceBottom - (labelPrice - this.minPrice) * this.yScale);
            if (labelPrice > this.minPrice) {
                this.moveTo(0, labelY);
                this.lineTo(this.xRight, labelY);
            }
        }
        this.context.lineWidth = 1;
        this.context.strokeStyle = ChartColors.GridColor;
        this.context.setLineDash([4, 2]);
        this.context.stroke();
        this.context.setLineDash([]);
    }
    drawHorizontalLabels() {
        this.context.font = '8pt Arial';
        this.context.textBaseline = 'middle';
        this.context.textAlign = 'left';
        this.context.fillStyle = ChartColors.ForeColor;
        for (let labelPrice = this.minPrice; labelPrice <= this.maxPrice + this.dataSet.point; labelPrice += this.deltaLabel) {
            const labelY = Math.round(this.yPriceBottom - (labelPrice - this.minPrice) * this.yScale);
            this.context.fillText(labelPrice.toFixed(this.dataSet.digits), this.xRight + 2, labelY);
        }
    }
    drawMainChartVerticalGrid() {
        this.context.beginPath();
        this.context.font = '8pt Arial';
        this.context.textBaseline = 'top';
        this.context.textAlign = 'center';
        this.context.fillStyle = ChartColors.ForeColor;
        const lastTime = DataHelper.barTimeToString(this.dataSet.time[this.chartLastBar]);
        const textWith = this.context.measureText(lastTime).width;
        const step = Math.ceil((textWith + 10) / this.barWidth);
        for (let bar = this.chartLastBar; bar >= this.chartFirstBar; bar -= step) {
            const x = (bar - this.chartFirstBar) * this.barWidth + this.xLeft;
            this.moveTo(x, this.yTop);
            this.lineTo(x, this.yPriceBottom + 3);
        }
        this.context.lineWidth = 1;
        this.context.strokeStyle = ChartColors.GridColor;
        this.context.setLineDash([4, 2]);
        this.context.stroke();
        this.context.setLineDash([]);
    }
    drawLabelsAndSepChartVerticalGrid() {
        this.context.beginPath();
        this.context.font = '8pt Arial';
        this.context.textBaseline = 'top';
        this.context.textAlign = 'center';
        this.context.fillStyle = ChartColors.ForeColor;
        const lastTime = DataHelper.barTimeToString(this.dataSet.time[this.chartLastBar]);
        const textWith = this.context.measureText(lastTime).width;
        const step = Math.ceil((textWith + 10) / this.barWidth);
        for (let bar = this.chartLastBar; bar >= this.chartFirstBar; bar -= step) {
            const x = (bar - this.chartFirstBar) * this.barWidth + this.xLeft;
            const text = DataHelper.barTimeToString(this.dataSet.time[bar]);
            this.context.fillText(text, x, this.yPriceBottom + 6);
        }
        this.context.lineWidth = 1;
        this.context.strokeStyle = ChartColors.GridColor;
        this.context.setLineDash([4, 2]);
        this.context.stroke();
        this.context.setLineDash([]);
    }
    drawVolumeBars() {
        this.context.beginPath();
        for (let bar = this.chartFirstBar; bar <= this.chartLastBar; bar++) {
            const x = (bar - this.chartFirstBar) * this.barWidth + this.xLeft;
            const yVolume = Math.round(this.yPriceBottom - this.dataSet.volume[bar] * this.yScaleVolume);
            this.moveTo(x, yVolume);
            this.lineTo(x, this.yPriceBottom - 1);
        }
        this.context.lineWidth = 1;
        this.context.strokeStyle = ChartColors.VolumeColor;
        this.context.stroke();
    }
    drawPriceBars() {
        this.context.beginPath();
        for (let bar = this.chartFirstBar; bar <= this.chartLastBar; bar++) {
            const x = (bar - this.chartFirstBar) * this.barWidth + this.xLeft;
            const yHigh = Math.round(this.yPriceBottom - (this.dataSet.high[bar] - this.minPrice) * this.yScale);
            const yLow = Math.round(this.yPriceBottom - (this.dataSet.low[bar] - this.minPrice) * this.yScale);
            const yOpen = Math.round(this.yPriceBottom - (this.dataSet.open[bar] - this.minPrice) * this.yScale);
            const yClose = Math.round(this.yPriceBottom - (this.dataSet.close[bar] - this.minPrice) * this.yScale);
            const xStart = x - this.barWidth / 2 + 1;
            const xEnd = xStart + this.barWidth - 2;
            if (yOpen > yClose) {
                this.context.fillStyle = ChartColors.BarWhite;
                this.fillRect(xStart, yOpen, this.barWidth - 2, yClose - yOpen);
                this.context.strokeStyle = ChartColors.BarBorderColor;
                this.strokeRect(xStart, yOpen, this.barWidth - 2, yClose - yOpen);
                this.moveTo(x, yHigh);
                this.lineTo(x, yClose);
                this.moveTo(x, yOpen);
                this.lineTo(x, yLow);
            }
            else if (yOpen < yClose) {
                this.context.fillStyle = ChartColors.BarBlack;
                this.fillRect(xStart, yClose, this.barWidth - 2, yOpen - yClose);
                this.context.strokeStyle = ChartColors.BarBorderColor;
                this.strokeRect(xStart, yClose, this.barWidth - 2, yOpen - yClose);
                this.moveTo(x, yHigh);
                this.lineTo(x, yOpen);
                this.moveTo(x, yClose);
                this.lineTo(x, yLow);
            }
            else {
                this.moveTo(x, yHigh);
                this.lineTo(x, yLow);
                this.moveTo(xStart, yOpen);
                this.lineTo(xEnd, yClose);
            }
        }
        this.context.lineWidth = 1;
        this.context.strokeStyle = ChartColors.BarBorderColor;
        this.context.stroke();
    }
    clearBelowMainChart() {
        this.context.clearRect(0, this.yPriceBottom, this.xRight, this.context.canvas.height - this.yPriceBottom);
    }
    clearLabelArea() {
        this.context.clearRect(this.xRight, 0, this.context.canvas.width - this.xRight, this.context.canvas.height);
    }
    drawTexts() {
        const bar = this.dataSet.bars - 1;
        const digits = this.dataSet.digits;
        const text = bar > 0
            ? this.dataSet.dataId.toNormalizedString() +
                ', Time: ' + DataHelper.barTimeToString(this.dataSet.time[bar]) +
                ', Open: ' + this.dataSet.open[bar].toFixed(digits) +
                ', High: ' + this.dataSet.high[bar].toFixed(digits) +
                ', Low: ' + this.dataSet.low[bar].toFixed(digits) +
                ', Close: ' + this.dataSet.close[bar].toFixed(digits)
            : 'There is no data! Please load data first to see the chart.';
        this.context.font = '9pt Arial';
        this.context.textBaseline = 'top';
        this.context.textAlign = 'left';
        this.context.fillStyle = ChartColors.ForeColor;
        this.context.fillText(text, this.space, 0);
    }
    drawAxes() {
        this.context.beginPath();
        this.moveTo(0, 0);
        this.lineTo(0, this.yBottom);
        this.moveTo(0, this.yPriceBottom);
        this.lineTo(this.xRight, this.yPriceBottom);
        this.moveTo(0, this.yBottom);
        this.lineTo(this.xRight, this.yBottom);
        this.context.lineWidth = 1;
        this.context.strokeStyle = ChartColors.ForeColor;
        this.context.stroke();
    }
    drawScrollBar() {
        this.context.fillStyle = '#DEDEDE';
        this.context.fillRect(0, this.yBottom + 1, this.xRight, this.scrollHeight);
        const thumbWidth = Math.round(this.xRight * this.chartBars / this.dataSet.bars);
        const xThumb = Math.round(this.xRight * this.chartFirstBar / this.dataSet.bars);
        this.context.fillStyle = '#333333';
        this.context.fillRect(xThumb, this.yBottom + 1, thumbWidth, this.scrollHeight);
    }
}
class PaginatorPresenter {
    constructor() {
        this.pageChange = null;
        this.view = new PaginatorView();
        this.buttons = this.view.buttonsList.length;
        this.totalPages = 0;
        this.currentPage = 0;
        this.activeButton = 0;
        this.firstButtonPage = 0;
        this.view_first_click = this.view_first_click.bind(this);
        this.view_prev_click = this.view_prev_click.bind(this);
        this.view_next_click = this.view_next_click.bind(this);
        this.view_last_click = this.view_last_click.bind(this);
        this.view_button_click = this.view_button_click.bind(this);
    }
    initView() {
        this.view.first.addEventListener('click', this.view_first_click);
        this.view.prev.addEventListener('click', this.view_prev_click);
        this.view.next.addEventListener('click', this.view_next_click);
        this.view.last.addEventListener('click', this.view_last_click);
        for (let i = 0; i < this.buttons; i++) {
            this.view.buttonsList[i].addEventListener('click', this.view_button_click);
        }
    }
    closeView() {
        this.view.first.removeEventListener('click', this.view_first_click);
        this.view.prev.removeEventListener('click', this.view_prev_click);
        this.view.next.removeEventListener('click', this.view_next_click);
        this.view.last.removeEventListener('click', this.view_last_click);
        for (let i = 0; i < this.buttons; i++) {
            this.view.buttonsList[i].removeEventListener('click', this.view_button_click);
        }
    }
    update(totalPages, currentPage) {
        this.totalPages = totalPages;
        this.currentPage = currentPage;
        if (this.currentPage === 0) {
            this.firstButtonPage = 0;
            this.activeButton = 0;
        }
        else if (this.totalPages <= this.buttons) {
            this.firstButtonPage = 0;
            this.activeButton = this.currentPage;
        }
        else {
            if (this.currentPage < this.firstButtonPage) {
                this.activeButton = 0;
                this.firstButtonPage = this.currentPage;
            }
            else if (this.firstButtonPage + this.buttons > this.totalPages) {
                this.activeButton = this.buttons - this.totalPages + this.currentPage;
                this.firstButtonPage = this.totalPages - this.activeButton - 1;
            }
        }
        this.setLeftArrowsStatus();
        this.setRightArrowsStatus();
        this.setButtonNumbers();
        this.setButtonDisabled();
        this.setActiveButton();
    }
    changePage(delta) {
        const view = this.activeButton + delta;
        if (view < 0) {
            this.firstButtonPage += view;
        }
        else if (view >= this.buttons) {
            this.firstButtonPage += view - this.buttons + 1;
        }
        this.currentPage += delta;
        this.activeButton = Math.max(this.activeButton + delta, 0);
        this.activeButton = Math.min(this.activeButton, this.buttons - 1, this.totalPages - 1);
        this.setLeftArrowsStatus();
        this.setRightArrowsStatus();
        this.setButtonNumbers();
        this.setButtonDisabled();
        this.setActiveButton();
        this.onPageChange();
    }
    setLeftArrowsStatus() {
        Dom.visible(this.view.first, this.totalPages >= this.buttons && this.firstButtonPage > 0);
        Dom.visible(this.view.prev, this.totalPages >= this.buttons && this.firstButtonPage >= 2);
        Dom.text(Dom.qs('a', this.view.first), '1');
    }
    setRightArrowsStatus() {
        Dom.visible(this.view.last, this.totalPages >= this.buttons && this.firstButtonPage + this.buttons < this.totalPages);
        Dom.visible(this.view.next, this.totalPages >= this.buttons && this.firstButtonPage + this.buttons < this.totalPages - 1);
        Dom.text(Dom.qs('a', this.view.last), this.totalPages.toString());
    }
    setButtonNumbers() {
        for (let i = 0; i < this.buttons; i++) {
            Dom.text(Dom.qs('a', this.view.buttonsList[i]), (this.firstButtonPage + i + 1).toString());
        }
    }
    setButtonDisabled() {
        for (let i = 0; i < this.buttons; i++) {
            Dom.visible(this.view.buttonsList[i], i < this.totalPages);
        }
    }
    setActiveButton() {
        for (let i = 0; i < this.buttons; i++) {
            if (i === this.activeButton && this.totalPages > 0) {
                Dom.addClass(this.view.buttonsList[i], 'active');
            }
            else {
                Dom.removeClass(this.view.buttonsList[i], 'active');
            }
        }
    }
    view_first_click(event) {
        event.preventDefault();
        this.changePage(-this.currentPage);
    }
    view_prev_click(event) {
        event.preventDefault();
        this.changePage(-1);
    }
    view_button_click(event) {
        event.preventDefault();
        const index = Number(event.currentTarget.id.substr(10));
        if (!this.view.buttonsList[index].classList.contains('active')) {
            this.changePage(index - this.activeButton);
        }
    }
    view_next_click(event) {
        event.preventDefault();
        this.changePage(1);
    }
    view_last_click(event) {
        event.preventDefault();
        this.changePage(this.totalPages - this.currentPage - 1);
    }
    onPageChange() {
        if (typeof this.pageChange === 'function') {
            this.pageChange(this.currentPage);
        }
    }
}
class PaginatorView {
    constructor() {
        const buttons = 5;
        this.first = document.getElementById('paginator-first');
        this.last = document.getElementById('paginator-last');
        this.prev = document.getElementById('paginator-prev');
        this.next = document.getElementById('paginator-next');
        this.buttonsList = [];
        for (let i = 0; i < buttons; i++) {
            this.buttonsList[i] = document.getElementById(`paginator-${i}`);
        }
    }
}
class AppViewModel {
    constructor() {
        this.symbolsModel = [];
    }
}
class ChartColors {
    static get ForeColor() {
        return '#1E1E1E';
    }
    static get GridColor() {
        return '#CCCCCC';
    }
    static get BarWhite() {
        return '#FFFFFF';
    }
    static get BarBlack() {
        return '#000000';
    }
    static get BarBorderColor() {
        return '#000000';
    }
    static get VolumeColor() {
        return '#9600D2';
    }
}
class DataBar {
    constructor() {
        this.time = 0;
        this.open = 0;
        this.high = Number.MIN_VALUE;
        this.low = Number.MAX_VALUE;
        this.close = 0;
        this.volume = 0;
    }
    clone() {
        const newBar = new DataBar();
        newBar.time = this.time;
        newBar.open = this.open;
        newBar.high = this.high;
        newBar.low = this.low;
        newBar.close = this.close;
        newBar.volume = this.volume;
        return newBar;
    }
}
class DataId {
    constructor() {
        this.source = 'Premium Data';
        this.symbol = 'EURUSD';
        this.period = DataPeriod.M30;
    }
    static create(source, symbol, period) {
        const dataId = new DataId();
        dataId.source = source;
        dataId.symbol = symbol;
        dataId.period = period;
        return dataId;
    }
    equal(dataId) {
        return dataId.source === this.source &&
            dataId.symbol === this.symbol &&
            dataId.period === this.period;
    }
    toString() {
        return this.source === ''
            ? this.symbol + '; ' + DataPeriod[this.period]
            : this.source + '; ' + this.symbol + '; ' + DataPeriod[this.period];
    }
    toNormalizedString() {
        return this.source === ''
            ? this.symbol + ' ' + DataPeriod[this.period]
            : this.source + ' ' + this.symbol + ' ' + DataPeriod[this.period];
    }
    get dataKey() {
        return this.symbol + ' ' + DataPeriod[this.period];
    }
    clone() {
        const dataId = new DataId();
        dataId.source = this.source;
        dataId.symbol = this.symbol;
        dataId.period = this.period;
        return dataId;
    }
}
class DataSet {
    constructor() {
        this.ver = 0;
        this.dataId = new DataId();
        this.terminal = '';
        this.company = '';
        this.server = '';
        this.symbol = '';
        this.period = DataPeriod.H1;
        this.baseCurrency = '';
        this.priceIn = '';
        this.lotSize = 0;
        this.stopLevel = 0;
        this.tickValue = 0;
        this.minLot = 0;
        this.maxLot = 0;
        this.lotStep = 0;
        this.spread = 0;
        this.point = 0;
        this.digits = 0;
        this.bars = 0;
        this.swapLong = 0;
        this.swapShort = 0;
        this.swapThreeDays = DayOfWeek.Friday;
        this.swapType = SwapType.Point;
        this.swapMode = SwapMode.Points;
        this.commission = 0;
        this.timezoneShift = 0;
        this.time = [];
        this.open = [];
        this.high = [];
        this.low = [];
        this.close = [];
        this.volume = [];
    }
    clone() {
        const dataSet = this.copyParams();
        dataSet.bars = this.bars;
        dataSet.time = this.time.slice();
        dataSet.open = this.open.slice();
        dataSet.high = this.high.slice();
        dataSet.low = this.low.slice();
        dataSet.close = this.close.slice();
        dataSet.volume = this.volume.slice();
        return dataSet;
    }
    copyParams() {
        const dataSet = new DataSet();
        dataSet.ver = this.ver;
        dataSet.dataId = this.dataId.clone();
        dataSet.terminal = this.terminal;
        dataSet.company = this.company;
        dataSet.server = this.server;
        dataSet.symbol = this.symbol;
        dataSet.period = this.period;
        dataSet.baseCurrency = this.baseCurrency;
        dataSet.priceIn = this.priceIn;
        dataSet.lotSize = this.lotSize;
        dataSet.stopLevel = this.stopLevel;
        dataSet.tickValue = this.tickValue;
        dataSet.minLot = this.minLot;
        dataSet.maxLot = this.maxLot;
        dataSet.lotStep = this.lotStep;
        dataSet.spread = this.spread;
        dataSet.digits = this.digits;
        dataSet.point = this.point;
        dataSet.swapLong = this.swapLong;
        dataSet.swapShort = this.swapShort;
        dataSet.swapType = this.swapType;
        dataSet.swapMode = this.swapMode;
        dataSet.swapThreeDays = this.swapThreeDays;
        dataSet.commission = this.commission;
        dataSet.timezoneShift = this.timezoneShift;
        return dataSet;
    }
}
class SelectGroup {
    constructor() {
        this.group = '';
        this.options = [];
    }
}
class SelectOption {
    constructor(value, text) {
        this.value = value;
        this.text = text;
    }
}
class Settings {
    constructor() {
        this.selectedSymbol = 'EURUSD';
        this.selectedPeriod = DataPeriod.H1;
        this.exportFormat = ExportFormat.fsbProCsv;
        this.maxBars = 50000;
        this.timezoneIndex = '80000050';
        this.filenamePrefix = '';
        this.filenameSuffix = '';
        this.serverName = 'Premium Data';
    }
    static deserialize(dto) {
        const settings = new Settings();
        if (typeof dto.selectedSymbol === 'string') {
            settings.selectedSymbol = dto.selectedSymbol;
        }
        if (typeof dto.selectedPeriod === 'number') {
            settings.selectedPeriod = dto.selectedPeriod;
        }
        if (typeof dto.exportFormat === 'number') {
            settings.exportFormat = dto.exportFormat;
        }
        if (typeof dto.timezoneIndex === 'string') {
            settings.timezoneIndex = dto.timezoneIndex;
        }
        if (typeof dto.maxBars === 'number') {
            settings.maxBars = dto.maxBars;
        }
        if (typeof dto.filenamePrefix === 'string') {
            settings.filenamePrefix = dto.filenamePrefix;
        }
        if (typeof dto.filenameSuffix === 'string') {
            settings.filenameSuffix = dto.filenameSuffix;
        }
        if (typeof dto.serverName === 'string') {
            settings.serverName = dto.serverName;
        }
        return settings;
    }
    serialize() {
        return this.clone();
    }
    clone() {
        const settings = new Settings();
        settings.selectedSymbol = this.selectedSymbol;
        settings.selectedPeriod = this.selectedPeriod;
        settings.exportFormat = this.exportFormat;
        settings.timezoneIndex = this.timezoneIndex;
        settings.maxBars = this.maxBars;
        settings.filenamePrefix = this.filenamePrefix;
        settings.filenameSuffix = this.filenameSuffix;
        settings.serverName = this.serverName;
        return settings;
    }
    resetSettings() {
        this.maxBars = 50000;
        this.timezoneIndex = '80000050';
        this.filenamePrefix = '';
        this.filenameSuffix = '';
        this.serverName = 'Premium Data';
    }
}
var DataPeriod;
(function (DataPeriod) {
    DataPeriod[DataPeriod["M1"] = 1] = "M1";
    DataPeriod[DataPeriod["M5"] = 5] = "M5";
    DataPeriod[DataPeriod["M15"] = 15] = "M15";
    DataPeriod[DataPeriod["M30"] = 30] = "M30";
    DataPeriod[DataPeriod["H1"] = 60] = "H1";
    DataPeriod[DataPeriod["H4"] = 240] = "H4";
    DataPeriod[DataPeriod["D1"] = 1440] = "D1";
    DataPeriod[DataPeriod["W1"] = 10080] = "W1";
    DataPeriod[DataPeriod["MN1"] = 43200] = "MN1";
})(DataPeriod || (DataPeriod = {}));
var DayOfWeek;
(function (DayOfWeek) {
    DayOfWeek[DayOfWeek["Sunday"] = 0] = "Sunday";
    DayOfWeek[DayOfWeek["Monday"] = 1] = "Monday";
    DayOfWeek[DayOfWeek["Tuesday"] = 2] = "Tuesday";
    DayOfWeek[DayOfWeek["Wednesday"] = 3] = "Wednesday";
    DayOfWeek[DayOfWeek["Thursday"] = 4] = "Thursday";
    DayOfWeek[DayOfWeek["Friday"] = 5] = "Friday";
    DayOfWeek[DayOfWeek["Saturday"] = 6] = "Saturday";
})(DayOfWeek || (DayOfWeek = {}));
var ExportFormat;
(function (ExportFormat) {
    ExportFormat[ExportFormat["fsbProCsv"] = 0] = "fsbProCsv";
    ExportFormat[ExportFormat["eaStudioJson"] = 1] = "eaStudioJson";
    ExportFormat[ExportFormat["metaTraderCsv"] = 2] = "metaTraderCsv";
    ExportFormat[ExportFormat["excelCsv"] = 3] = "excelCsv";
})(ExportFormat || (ExportFormat = {}));
var SwapMode;
(function (SwapMode) {
    SwapMode[SwapMode["Disabled"] = 0] = "Disabled";
    SwapMode[SwapMode["Points"] = 1] = "Points";
    SwapMode[SwapMode["CurrencySymbol"] = 2] = "CurrencySymbol";
    SwapMode[SwapMode["CurrencyMargin"] = 3] = "CurrencyMargin";
    SwapMode[SwapMode["CurrencyDeposit"] = 4] = "CurrencyDeposit";
    SwapMode[SwapMode["InterestCurrent"] = 5] = "InterestCurrent";
    SwapMode[SwapMode["InterestOpen"] = 6] = "InterestOpen";
    SwapMode[SwapMode["ReopenCurrent"] = 7] = "ReopenCurrent";
    SwapMode[SwapMode["ReopenBid"] = 8] = "ReopenBid";
})(SwapMode || (SwapMode = {}));
var SwapType;
(function (SwapType) {
    SwapType[SwapType["Point"] = 0] = "Point";
    SwapType[SwapType["BaseCurrency"] = 1] = "BaseCurrency";
    SwapType[SwapType["InterestRate"] = 2] = "InterestRate";
    SwapType[SwapType["MarginCurrency"] = 3] = "MarginCurrency";
})(SwapType || (SwapType = {}));
class DomEventSubscriber {
    constructor(context) {
        this.context = context;
        this.eventStorage = [];
    }
    subscribeAll(collection, event, eventHandler, param) {
        for (let i = 0; i < collection.length; i++) {
            if (arguments.length === 4) {
                this.subscribe(collection[i], event, eventHandler, param);
            }
            else {
                this.subscribe(collection[i], event, eventHandler);
            }
        }
    }
    subscribe(element, event, eventHandler, param) {
        const eventContext = {
            element: element,
            event: event,
            eventHandler: arguments.length === 4
                ? eventHandler.bind(this.context, param)
                : eventHandler.bind(this.context),
        };
        eventContext.element.addEventListener(eventContext.event, eventContext.eventHandler);
        this.eventStorage.push(eventContext);
    }
    unsubscribeAll() {
        const eventSubscription = this.eventStorage.shift();
        if (eventSubscription) {
            eventSubscription.element.removeEventListener(eventSubscription.event, eventSubscription.eventHandler);
            this.unsubscribeAll();
        }
    }
}
class Dom {
    static gebcn(className) {
        return Array.prototype.slice.call(document.getElementsByClassName(className));
    }
    static gebid(id) {
        return document.getElementById(id);
    }
    static gebtn(tagName) {
        return Array.prototype.slice.call(document.getElementsByTagName(tagName));
    }
    static qs(selector, parent) {
        return (parent || document).querySelector(selector);
    }
    static child(element, index) {
        return element.children[index];
    }
    static show(element) {
        element.style.display = 'block';
    }
    static hide(element) {
        element.style.display = 'none';
    }
    static visible(element, isVisible) {
        element.style.display = isVisible ? 'block' : 'none';
    }
    static text(element, text) {
        if (typeof text === 'string') {
            element.textContent = text;
            return text;
        }
        return String(element.textContent).trim();
    }
    static value(element, value) {
        if (typeof value === 'string') {
            element.value = value;
            return value;
        }
        return element.value.trim();
    }
    static innerHtml(element, html) {
        if (typeof html === 'string') {
            element.innerHTML = html;
            return html;
        }
        return element.innerHTML;
    }
    static checked(element, isChecked) {
        if (typeof isChecked === 'boolean') {
            element.checked = isChecked;
            return isChecked;
        }
        return element.checked;
    }
    static disabled(element, disabled) {
        if (typeof disabled === 'boolean') {
            element.disabled = disabled;
            return disabled;
        }
        return element.disabled;
    }
    static addClass(element, className) {
        element.classList.add(className);
    }
    static removeClass(element, className) {
        element.classList.remove(className);
    }
}
class IoService {
    static getData(url, callback) {
        const httpRequest = new XMLHttpRequest();
        httpRequest.open('GET', url, true);
        httpRequest.setRequestHeader('Pragma', 'no-cache');
        httpRequest.setRequestHeader('Cache-Control', 'no-cache');
        httpRequest.setRequestHeader('Content-Type', 'max-age=0');
        httpRequest.onload = () => callback(null, httpRequest.responseText);
        httpRequest.onerror = () => callback('An error occurred during the transaction', null);
        httpRequest.send();
    }
    static downloadTextAsFile(filename, content) {
        const blobObject = new Blob([content], { type: 'application/octet-binary' });
        if (typeof navigator.msSaveBlob === 'function') {
            window.navigator.msSaveBlob(blobObject, filename);
        }
        else {
            const anchorElement = window.document.createElement('a');
            anchorElement.href = window.URL.createObjectURL(blobObject);
            anchorElement.download = filename;
            document.body.appendChild(anchorElement);
            anchorElement.click();
            document.body.removeChild(anchorElement);
        }
    }
    static setItemToLocalStorage(key, item) {
        try {
            if (typeof item === 'string') {
                localStorage.setItem(key, item);
            }
            else {
                localStorage.setItem(key, JSON.stringify(item));
            }
        }
        catch (e) {
            console.error('Set item to local storage ' + key + ': ' + e.message);
        }
    }
    static getItemFromLocalStorage(key) {
        try {
            const value = localStorage.getItem(key);
            return value && JSON.parse(value);
        }
        catch (e) {
            console.error('Get item from local storage ' + key + ': ' + e.message);
            return null;
        }
    }
}
class TimeHelper {
    static dateToTimeString(date) {
        const toString = (n) => n < 10 ? '0' + n : '' + n;
        return '' +
            toString(date.getUTCHours()) + ':' +
            toString(date.getUTCMinutes());
    }
    static dateToDateString(date) {
        const toString = (n) => n < 10 ? '0' + n : '' + n;
        return '' +
            date.getUTCFullYear() + '-' +
            toString(date.getUTCMonth() + 1) + '-' +
            toString(date.getUTCDate());
    }
}
class ViewHelper {
    static removeAllChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
    static updateSelectOptions(selectElement, optionsData) {
        const fragment = document.createDocumentFragment();
        for (const option of optionsData) {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            fragment.appendChild(optionElement);
        }
        ViewHelper.removeAllChildren(selectElement);
        selectElement.appendChild(fragment);
    }
    static updateSelectGroups(selectElement, selectGroups) {
        const fragment = document.createDocumentFragment();
        for (const group of selectGroups) {
            const optionGroup = document.createElement('optgroup');
            optionGroup.label = group.group;
            for (const option of group.options) {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                optionGroup.appendChild(optionElement);
            }
            fragment.appendChild(optionGroup);
        }
        ViewHelper.removeAllChildren(selectElement);
        selectElement.appendChild(fragment);
    }
}
class AcquisitionPresenter {
    constructor() {
        this.periodIndex = [1, 5, 15, 30, 60, 240, 1440];
        this.view = new AcquisitionView();
        this.domEventSubscriber = new DomEventSubscriber(this);
        this.exportFormatChanged = null;
        this.viewActive = false;
        this.clearAcquisitionTable();
    }
    initView() {
        this.resetAcquisitionTable();
        Dom.value(this.view.selectFormat, app.settings.exportFormat.toString());
        this.domEventSubscriber.subscribe(this.view.selectFormat, 'change', this.view_selectFormat_changed);
        for (let i = 0; i < 7; i++) {
            const row = this.view.acquisitionTable.rows[i];
            const downloadLink = Dom.child(row.cells[5], 0);
            this.domEventSubscriber.subscribe(downloadLink, 'click', this.downloadLink_click, this.periodIndex[i]);
        }
        this.viewActive = true;
    }
    closeView() {
        this.viewActive = false;
        this.domEventSubscriber.unsubscribeAll();
    }
    resetAcquisitionTable() {
        if (this.viewActive) {
            this.clearAcquisitionTable();
        }
    }
    clearAcquisitionTable() {
        for (let rowIndex = 0; rowIndex < 7; rowIndex++) {
            const row = this.view.acquisitionTable.rows[rowIndex];
            Dom.text(row.cells[0], app.settings.selectedSymbol);
            Dom.text(row.cells[2], '0');
            Dom.text(row.cells[3], '-');
            Dom.text(row.cells[4], '-');
            const downloadLink = Dom.child(row.cells[5], 0);
            Dom.text(downloadLink, '-');
            Dom.removeClass(downloadLink, 'text-secondary');
            Dom.addClass(downloadLink, 'text-dark');
            Dom.hide(downloadLink);
        }
    }
    setLoadingToAcquisitionTable() {
        for (let rowIndex = 0; rowIndex < 7; rowIndex++) {
            const row = this.view.acquisitionTable.rows[rowIndex];
            Dom.text(row.cells[0], app.settings.selectedSymbol);
            Dom.text(row.cells[2], '0');
            Dom.text(row.cells[3], 'Fetching data...');
            Dom.text(row.cells[4], '-');
            const downloadLink = Dom.child(row.cells[5], 0);
            Dom.hide(downloadLink);
            Dom.text(downloadLink, '-');
            Dom.removeClass(downloadLink, 'text-secondary');
            Dom.addClass(downloadLink, 'text-dark');
        }
    }
    updateAcquisitionTable(dataSet) {
        const period = dataSet.period;
        const rowIndex = this.periodIndex.indexOf(period);
        const row = this.view.acquisitionTable.rows[rowIndex];
        Dom.text(row.cells[0], app.settings.selectedSymbol);
        Dom.text(row.cells[2], dataSet.bars.toString());
        Dom.text(row.cells[3], DataHelper.barTimeToString(dataSet.time[0]));
        Dom.text(row.cells[4], DataHelper.barTimeToString(dataSet.time[dataSet.bars - 1] + period * 60 * 1000));
        const downloadLink = Dom.child(row.cells[5], 0);
        Dom.text(downloadLink, 'Composing file....');
        Dom.removeClass(downloadLink, 'text-secondary');
        Dom.addClass(downloadLink, 'text-dark');
        Dom.show(downloadLink);
    }
    view_selectFormat_changed(event) {
        event.preventDefault();
        app.settings.exportFormat = Number(Dom.value(this.view.selectFormat));
        if (typeof this.exportFormatChanged === 'function') {
            this.exportFormatChanged();
        }
    }
    exportManager_exportFile_ready(dataId) {
        const fileName = this.getFileName(app.settings.exportFormat, dataId.symbol, dataId.period);
        const row = this.view.acquisitionTable.rows[this.periodIndex.indexOf(dataId.period)];
        const downloadLink = Dom.child(row.cells[5], 0);
        Dom.text(downloadLink, fileName);
        Dom.removeClass(downloadLink, 'text-secondary');
        Dom.removeClass(downloadLink, 'text-dark');
    }
    downloadLink_click(period, event) {
        event.preventDefault();
        this.manageExportFile(app.getDataId(period));
        const row = this.view.acquisitionTable.rows[this.periodIndex.indexOf(period)];
        const downloadLink = Dom.child(row.cells[5], 0);
        Dom.addClass(downloadLink, 'text-secondary');
    }
    manageExportFile(dataId) {
        const fileName = this.getFileName(app.settings.exportFormat, dataId.symbol, dataId.period);
        app.exportManager.exportFile(dataId, fileName);
    }
    getFileName(format, symbol, period) {
        const prefix = this.formatFileNamePlaceHolders(app.settings.filenamePrefix);
        const suffix = this.formatFileNamePlaceHolders(app.settings.filenameSuffix);
        switch (format) {
            case ExportFormat.eaStudioJson:
                return prefix + symbol + '_' + DataPeriod[period] + suffix + '.json';
            case ExportFormat.fsbProCsv:
                return prefix + symbol + period + suffix + '.csv';
            case ExportFormat.metaTraderCsv:
                return prefix + symbol + '_' + DataPeriod[period] + suffix + '.csv';
            case ExportFormat.excelCsv:
                return prefix + symbol + '_' + DataPeriod[period] + suffix + '.csv';
        }
    }
    formatFileNamePlaceHolders(pattern) {
        return pattern
            .replace(/{DATE}/, TimeHelper.dateToDateString(new Date()))
            .replace(/{TIME}/, TimeHelper.dateToTimeString(new Date()))
            .replace(/{SERVER}/, app.settings.serverName);
    }
}
class ApplicationPresenter {
    constructor() {
        this.view = new ApplicationView();
        this.domEventSubscriber = new DomEventSubscriber(this);
        this.lastLoadTime = 0;
        this.activeToolPanel = '';
        this.acquisitionPresenter = new AcquisitionPresenter();
        this.chartPresenter = new ChartPresenter();
        this.previewPresenter = new PreviewPresenter();
        this.statsPresenter = new StatsPresenter();
        this.settingsPresenter = new SettingsPresenter();
        ViewHelper.updateSelectGroups(this.view.selectSymbol, app.appViewModel.symbolsModel);
        this.view.selectSymbol.value = app.settings.selectedSymbol;
        this.domEventSubscriber.subscribe(this.view.selectSymbol, 'change', this.view_selectSymbol_changed);
        this.domEventSubscriber.subscribe(this.view.btnLoadData, 'click', this.view_btnLoadData_click);
        this.domEventSubscriber.subscribeAll(this.view.linkSwitch, 'click', this.view_linkSwitch_click);
        this.acquisitionPresenter.exportFormatChanged = this.acquisition_exportFormat_changed.bind(this);
        this.settingsPresenter.settingsChanged = this.settingsPresenter_settingsChanged.bind(this);
        this.activateToolPanel('acquisition');
    }
    view_selectSymbol_changed(event) {
        event.preventDefault();
        app.settings.selectedSymbol = this.view.selectSymbol.value;
        app.dataManager.releaseDataFiles();
        app.exportManager.releaseDataFiles();
        this.resetViews();
        this.setLoadDataButtonActive();
    }
    resetViews() {
        this.acquisitionPresenter.resetAcquisitionTable();
        this.chartPresenter.resetChart();
        this.previewPresenter.resetPreview();
        this.statsPresenter.resetStats();
    }
    view_btnLoadData_click(event) {
        event.preventDefault();
        this.acquireData();
        this.setLoadDataButtonInactive();
    }
    view_linkSwitch_click(event) {
        event.preventDefault();
        const link = event.target;
        const panelName = link.getAttribute('data-panel-switch');
        if (this.activeToolPanel === panelName) {
            return;
        }
        this.view.linkSwitch.forEach((e) => Dom.removeClass(e, 'active'));
        Dom.addClass(link, 'active');
        this.changeToolPanel(panelName);
        this.activateToolPanel(panelName);
    }
    acquireData() {
        this.manageCoolDown();
        this.acquisitionPresenter.setLoadingToAcquisitionTable();
        [1, 5, 15, 30].forEach((p) => this.loadData(p));
    }
    changeToolPanel(panelName) {
        const panelId = 'panel-' + panelName;
        this.view.toolPanel.forEach((panel) => {
            Dom.visible(panel, panel.id === panelId);
        });
    }
    activateToolPanel(panelName) {
        this.activeToolPanel = panelName;
        if (panelName === 'acquisition') {
            this.acquisitionPresenter.initView();
        }
        else {
            this.acquisitionPresenter.closeView();
        }
        if (panelName === 'price-chart') {
            this.chartPresenter.initView();
            this.chartPresenter.drawIndicatorChart();
        }
        else {
            this.chartPresenter.closeView();
        }
        if (panelName === 'data-preview') {
            this.previewPresenter.initView();
            this.previewPresenter.drawDataTable();
        }
        else {
            this.previewPresenter.closeView();
        }
        if (panelName === 'data-stats') {
            this.statsPresenter.initView();
            this.statsPresenter.updateStats();
        }
        else {
            this.statsPresenter.closeView();
        }
        if (panelName === 'settings') {
            this.settingsPresenter.initView();
        }
        else {
            this.settingsPresenter.closeView();
        }
    }
    manageCoolDown() {
        const now = Date.now();
        if (now < this.lastLoadTime + 30 * 60 * 1000) {
            return;
        }
        this.lastLoadTime = now;
        app.dataManager.releaseDataFiles();
        app.exportManager.releaseDataFiles();
        this.setLoadDataButtonActive();
    }
    loadData(period) {
        app.dataManager.loadData(app.getDataId(period), this.dataManager_getData_ready.bind(this));
    }
    dataManager_getData_ready(dataSet) {
        if (dataSet) {
            this.manageInputData(dataSet);
        }
    }
    manageInputData(dataSet) {
        const timezone = app.timezones.filter(tz => tz.index === app.settings.timezoneIndex)[0];
        if (timezone.shift !== dataSet.timezoneShift) {
            dataSet.timezoneShift = timezone.shift;
            app.dataManager.applyTimezoneShift(dataSet.dataId, timezone.shift);
        }
        if (dataSet.period === DataPeriod.M30) {
            setTimeout(this.generateLtf.bind(this), 0, dataSet, [60, 240, 1440]);
        }
        const outputDataSet = DataHelper.cutDataSet(dataSet, app.settings.maxBars);
        this.manageOutputData(outputDataSet);
    }
    generateLtf(dataSet, periods) {
        const ltfDataSet = DataHelper.generateLtfBars(dataSet, periods[0]);
        const outputDataSet = DataHelper.cutDataSet(ltfDataSet, app.settings.maxBars);
        app.dataManager.setData(outputDataSet);
        this.manageOutputData(outputDataSet);
        if (periods.length > 1) {
            setTimeout(this.generateLtf.bind(this), 0, ltfDataSet, periods.slice(1));
        }
    }
    manageOutputData(dataSet) {
        this.acquisitionPresenter.updateAcquisitionTable(dataSet);
        app.exportManager.setExportDataSet(dataSet);
        app.exportManager.makeExportFile(dataSet.dataId, app.settings.exportFormat, this.acquisitionPresenter.exportManager_exportFile_ready.bind(this.acquisitionPresenter));
        this.updateToolPanel(dataSet);
    }
    updateToolPanel(dataSet) {
        if (dataSet.period === app.settings.selectedPeriod) {
            if (['price-chart', 'data-preview', 'data-stats'].indexOf(this.activeToolPanel) >= 0) {
                this.activateToolPanel(this.activeToolPanel);
            }
        }
    }
    acquisition_exportFormat_changed() {
        if (!app.dataManager.getData(app.getDataId(DataPeriod.M30))) {
            return;
        }
        const periods = [DataPeriod.M1, DataPeriod.M5, DataPeriod.M15, DataPeriod.M30,
            DataPeriod.H1, DataPeriod.H4, DataPeriod.D1];
        const dataSets = periods
            .map((period) => app.dataManager.getData(app.getDataId(period)))
            .filter((dataSet) => dataSet !== null)
            .map((dataSet) => DataHelper.cutDataSet(dataSet, app.settings.maxBars));
        dataSets.forEach(dataSet => this.acquisitionPresenter.updateAcquisitionTable(dataSet));
        setTimeout(this.manageOutputDataLoop.bind(this), 0, dataSets);
    }
    manageOutputDataLoop(dataSets) {
        if (dataSets.length === 0) {
            return;
        }
        const outputDataSet = DataHelper.cutDataSet(dataSets[0], app.settings.maxBars);
        this.manageOutputData(outputDataSet);
        setTimeout(this.manageOutputDataLoop.bind(this), 0, dataSets.slice(1));
    }
    settingsPresenter_settingsChanged() {
        app.dataManager.releaseDataFiles();
        app.exportManager.releaseDataFiles();
        this.resetViews();
        this.acquisitionPresenter.clearAcquisitionTable();
        this.setLoadDataButtonActive();
    }
    setLoadDataButtonActive() {
        Dom.removeClass(this.view.btnLoadData, 'btn-secondary');
        Dom.addClass(this.view.btnLoadData, 'btn-primary');
    }
    setLoadDataButtonInactive() {
        Dom.removeClass(this.view.btnLoadData, 'btn-primary');
        Dom.addClass(this.view.btnLoadData, 'btn-secondary');
    }
}
class ChartPresenter {
    constructor() {
        this.view = new ChartView();
        this.domEventSubscriber = new DomEventSubscriber(this);
        this.viewActive = false;
        this.chartMouseDown = false;
        this.chartMouseX = 0;
        this.chartBars = 0;
        this.chartStartBar = -1;
        this.chartActiveBar = -1;
        this.chartBarWidth = 10;
    }
    initView() {
        this.resetChart();
        this.view.selectChartPeriod.value = DataPeriod[app.settings.selectedPeriod];
        this.domEventSubscriber.subscribe(this.view.selectChartPeriod, 'change', this.view_selectChartPeriod_changed);
        this.domEventSubscriber.subscribe(this.view.canvasIndicatorChart, 'mousedown', this.view_indicatorChart_mouseDown);
        this.domEventSubscriber.subscribe(this.view.canvasIndicatorChart, 'mouseleave', this.view_indicatorChart_mouseLeave);
        this.domEventSubscriber.subscribe(this.view.canvasIndicatorChart, 'mousemove', this.view_indicatorChart_mouseMove);
        this.domEventSubscriber.subscribe(this.view.window, 'mouseup', this.view_window_mouseUp);
        this.domEventSubscriber.subscribe(this.view.window, 'mousemove', this.view_window_mouseMove);
        this.domEventSubscriber.subscribe(this.view.window, 'resize', this.view_window_resize);
        this.domEventSubscriber.subscribe(document, 'keydown', this.document_keyDown_event);
        this.viewActive = true;
    }
    closeView() {
        this.viewActive = false;
        this.domEventSubscriber.unsubscribeAll();
    }
    resetChart() {
        this.chartStartBar = -1;
        this.chartActiveBar = -1;
        this.chartBars = 0;
        this.chartMouseX = 0;
        this.chartMouseDown = false;
        if (this.viewActive) {
            this.drawIndicatorChart();
        }
    }
    drawIndicatorChart() {
        if (!this.viewActive) {
            return;
        }
        this.view.canvasIndicatorChart.height = this.view.canvasIndicatorChart.parentElement.clientHeight;
        this.view.canvasIndicatorChart.width = this.view.canvasIndicatorChart.parentElement.clientWidth;
        const chartContext = this.view.canvasIndicatorChart.getContext('2d');
        if (!chartContext) {
            return;
        }
        const dataId = app.getDataId();
        const dataSet = app.dataManager.getData(dataId);
        this.indicatorChart = new IndicatorChart(chartContext);
        this.indicatorChart.barWidth = this.chartBarWidth;
        if (dataSet) {
            const cutDataSet = DataHelper.cutDataSet(dataSet, app.settings.maxBars);
            if (this.chartStartBar === -1) {
                this.chartStartBar = cutDataSet.bars - 20;
            }
            this.indicatorChart.draw(cutDataSet, this.chartStartBar);
        }
        else {
            this.indicatorChart.draw(null, this.chartStartBar);
        }
        this.chartStartBar = this.indicatorChart.chartFirstBar;
        this.chartBars = this.indicatorChart.chartBars;
    }
    view_selectChartPeriod_changed(event) {
        event.preventDefault();
        app.settings.selectedPeriod = DataPeriod[this.view.selectChartPeriod.value];
        this.resetChart();
        this.drawIndicatorChart();
    }
    view_indicatorChart_mouseDown(event) {
        this.chartMouseDown = true;
        this.chartMouseX = event.pageX;
    }
    view_indicatorChart_mouseMove(event) {
        const rect = this.view.canvasIndicatorChart.getBoundingClientRect();
        if (this.indicatorChart) {
            const mouseX = event.pageX - rect.left;
            const bar = this.indicatorChart.getBarNumberAtX(mouseX);
            this.showIndicatorChartDynamicInfo(bar);
        }
    }
    view_indicatorChart_mouseLeave() {
        this.view.indicatorChartInfoPanel.textContent = '';
    }
    showIndicatorChartDynamicInfo(bar) {
        const dataId = app.getDataId();
        const dataSetBars = app.dataManager.getDataSetLength(dataId);
        if (bar >= 0 && bar < dataSetBars && bar !== this.chartActiveBar) {
            this.chartActiveBar = bar;
        }
        else {
            return;
        }
        try {
            this.view.indicatorChartInfoPanel.innerHTML = this.getBarDataHtml(bar);
        }
        catch (e) {
            this.view.indicatorChartInfoPanel.innerHTML = '<strong><span class="text-danger">Something went wrong: ${e}</span></strong>';
        }
    }
    getBarDataHtml(bar) {
        const dataId = app.getDataId();
        const barData = app.dataManager.getBarData(dataId, bar);
        if (!barData) {
            return '';
        }
        const digits = barData.digits;
        return 'Bar: ' + (bar + 1).toString() +
            ', Time: ' + DataHelper.barTimeToString(barData.time) +
            ', Open: ' + barData.open.toFixed(digits) +
            ', High: ' + barData.high.toFixed(digits) +
            ', Low: ' + barData.low.toFixed(digits) +
            ', Close: ' + barData.close.toFixed(digits) +
            ', Volume: ' + barData.volume.toString();
    }
    view_window_mouseUp() {
        this.chartMouseDown = false;
    }
    view_window_mouseMove(event) {
        if (this.chartMouseDown) {
            if (event.pageX > this.chartMouseX) {
                this.chartMouseX = event.pageX;
                this.chartStartBar -= (this.chartBarWidth > 10 ? 3 : 6);
                this.scrollChart();
            }
            else if (event.pageX < this.chartMouseX) {
                this.chartStartBar += (this.chartBarWidth > 10 ? 3 : 6);
                this.chartMouseX = event.pageX;
                this.scrollChart();
            }
        }
    }
    scrollChart() {
        const dataId = app.getDataId();
        const dataSetBars = app.dataManager.getDataSetLength(dataId);
        if (this.chartStartBar < 0) {
            this.chartStartBar = 0;
        }
        else if (this.chartStartBar > dataSetBars - 20) {
            this.chartStartBar = dataSetBars - 20;
        }
        this.drawIndicatorChart();
    }
    document_keyDown_event(event) {
        const keyName = event.key;
        if (keyName === 'Home') {
            this.chartStartBar = 0;
        }
        else if (keyName === 'End') {
            const dataId = app.getDataId();
            this.chartStartBar = app.dataManager.getDataSetLength(dataId) - 20;
        }
        else if (keyName === 'ArrowLeft') {
            this.chartStartBar -= (this.chartBarWidth > 10 ? 4 : 8);
        }
        else if (keyName === 'ArrowRight') {
            this.chartStartBar += (this.chartBarWidth > 10 ? 4 : 8);
        }
        else if (keyName === '-') {
            const newBarWidth = Math.max(4, this.chartBarWidth - 2);
            const newBars = this.chartBars * (this.chartBarWidth / newBarWidth);
            this.chartStartBar -= Math.round((newBars - this.chartBars) / 2);
            this.chartBarWidth = newBarWidth;
        }
        else if (keyName === '+' || keyName === '=') {
            const newBarWidth = Math.min(30, this.chartBarWidth + 2);
            const newBars = this.chartBars * (this.chartBarWidth / newBarWidth);
            this.chartStartBar += Math.round((this.chartBars - newBars) / 2);
            this.chartBarWidth = newBarWidth;
        }
        else {
            return;
        }
        event.preventDefault();
        this.scrollChart();
    }
    view_window_resize() {
        this.drawIndicatorChart();
    }
}
class PreviewPresenter {
    constructor() {
        this.view = new PreviewView();
        this.domEventSubscriber = new DomEventSubscriber(this);
        this.viewActive = false;
        this.dataTableLines = 50;
        this.dataTableTopLine = 0;
        Dom.value(this.view.selectPreviewPeriod, DataPeriod[app.settings.selectedPeriod]);
        this.paginatorPresenter = new PaginatorPresenter();
        this.paginatorPresenter.pageChange = this.paginatorPresenter_pageChange.bind(this);
    }
    initView() {
        this.resetPreview();
        Dom.value(this.view.selectPreviewPeriod, DataPeriod[app.settings.selectedPeriod]);
        this.paginatorPresenter.initView();
        this.domEventSubscriber.subscribe(this.view.selectPreviewPeriod, 'change', this.view_selectPreviewPeriod_changed);
        this.viewActive = true;
    }
    closeView() {
        this.paginatorPresenter.closeView();
        this.viewActive = false;
        this.domEventSubscriber.unsubscribeAll();
    }
    resetPreview() {
        this.dataTableTopLine = 0;
        this.updatePaginator();
        if (this.viewActive) {
            this.drawDataTable();
        }
    }
    drawDataTable() {
        if (!this.viewActive) {
            return;
        }
        const tableContentList = [];
        const dataId = app.getDataId();
        const dataSet = app.dataManager.getData(dataId);
        if (dataSet) {
            const cutDataSet = DataHelper.cutDataSet(dataSet, app.settings.maxBars);
            for (let i = 0; i < this.dataTableLines; i++) {
                const index = i + this.dataTableTopLine;
                if (index > cutDataSet.bars - 1) {
                    break;
                }
                const digits = cutDataSet.digits;
                const tableRow = '<tr>' +
                    `<td>${DataHelper.barTimeToString(cutDataSet.time[index])}</td>` +
                    `<td>${cutDataSet.open[index].toFixed(digits)}</td>` +
                    `<td>${cutDataSet.high[index].toFixed(digits)}</td>` +
                    `<td>${cutDataSet.low[index].toFixed(digits)}</td>` +
                    `<td>${cutDataSet.close[index].toFixed(digits)}</td>` +
                    `<td>${cutDataSet.volume[index].toString()}</td>` +
                    '</tr>';
                tableContentList.push(tableRow);
            }
        }
        else {
            tableContentList[0] = '<tr><td colspan="6">' +
                'There is no data! Please load data first to see the data preview.' + '</td></tr>';
        }
        Dom.innerHtml(this.view.tableDataPreview, tableContentList.join('\r\n'));
    }
    updatePaginator() {
        const dataId = app.getDataId();
        const records = Math.min(app.dataManager.getDataSetLength(dataId), app.settings.maxBars);
        const pages = Math.ceil(records / this.dataTableLines);
        const page = Math.floor(this.dataTableTopLine / this.dataTableLines);
        this.paginatorPresenter.update(pages, page);
    }
    view_selectPreviewPeriod_changed(event) {
        event.preventDefault();
        app.settings.selectedPeriod = DataPeriod[Dom.value(this.view.selectPreviewPeriod)];
        this.resetPreview();
    }
    paginatorPresenter_pageChange(page) {
        this.dataTableTopLine = this.dataTableLines * page;
        this.drawDataTable();
    }
}
class SettingsPresenter {
    constructor() {
        this.view = new SettingsView();
        this.domEventSubscriber = new DomEventSubscriber(this);
        this.settingsChanged = null;
    }
    initView() {
        const timezoneOptions = app.timezones.map(e => new SelectOption(e.index, e.time));
        ViewHelper.updateSelectOptions(this.view.selectTimezone, timezoneOptions);
        this.resetView();
        this.domEventSubscriber.subscribe(this.view.btnReset, 'click', this.view_btnReset_click);
        this.domEventSubscriber.subscribe(this.view.selectMaxBars, 'change', this.view_settings_changed);
        this.domEventSubscriber.subscribe(this.view.selectTimezone, 'change', this.view_settings_changed);
        this.domEventSubscriber.subscribe(this.view.inputPrefix, 'change', this.view_settings_changed);
        this.domEventSubscriber.subscribe(this.view.inputSuffix, 'change', this.view_settings_changed);
        this.domEventSubscriber.subscribe(this.view.inputServer, 'change', this.view_settings_changed);
    }
    closeView() {
        this.domEventSubscriber.unsubscribeAll();
    }
    resetView() {
        Dom.value(this.view.selectMaxBars, app.settings.maxBars.toString());
        Dom.value(this.view.selectTimezone, app.settings.timezoneIndex);
        Dom.value(this.view.inputPrefix, app.settings.filenamePrefix);
        Dom.value(this.view.inputSuffix, app.settings.filenameSuffix);
        Dom.value(this.view.inputServer, app.settings.serverName);
    }
    view_settings_changed(event) {
        event.preventDefault();
        app.settings.maxBars = parseInt(Dom.value(this.view.selectMaxBars));
        app.settings.timezoneIndex = Dom.value(this.view.selectTimezone);
        app.settings.filenamePrefix = Dom.value(this.view.inputPrefix);
        app.settings.filenameSuffix = Dom.value(this.view.inputSuffix);
        app.settings.serverName = Dom.value(this.view.inputServer);
        this.onSettingsChanged();
    }
    view_btnReset_click(event) {
        event.preventDefault();
        app.settings.resetSettings();
        this.resetView();
        this.onSettingsChanged();
    }
    onSettingsChanged() {
        if (typeof this.settingsChanged === 'function') {
            this.settingsChanged();
        }
    }
}
class StatsPresenter {
    constructor() {
        this.view = new StatsView();
        this.domEventSubscriber = new DomEventSubscriber(this);
        this.viewActive = false;
    }
    initView() {
        this.resetStats();
        this.view.selectStatsPeriod.value = DataPeriod[app.settings.selectedPeriod];
        this.domEventSubscriber.subscribe(this.view.selectStatsPeriod, 'change', this.view_selectStatsPeriod_changed);
        this.viewActive = true;
    }
    closeView() {
        this.viewActive = false;
        this.domEventSubscriber.unsubscribeAll();
    }
    resetStats() {
        if (this.viewActive) {
            this.updateStats();
        }
    }
    updateStats() {
        if (!this.viewActive) {
            return;
        }
        const rawDataSet = app.dataManager.getData(app.getDataId());
        if (rawDataSet) {
            const dataSet = DataHelper.cutDataSet(rawDataSet, app.settings.maxBars);
            setTimeout(this.setPropertiesTableBody.bind(this, dataSet), 0);
            setTimeout(this.setStatisticsTableBody.bind(this, dataSet), 0);
            setTimeout(this.setMaxDaysOffTableBody.bind(this, dataSet), 0);
            setTimeout(this.setMaxCloseOpenTableBody.bind(this, dataSet), 0);
            setTimeout(this.setMaxHighLowTableBody.bind(this, dataSet), 0);
            setTimeout(this.setMaxGapTableBody.bind(this, dataSet), 0);
        }
        else {
            Dom.text(this.view.tableProperties, '');
            Dom.text(this.view.tableStatistics, '');
            Dom.text(this.view.tableMaxDaysOff, '');
            Dom.text(this.view.tableMaxCloseOpen, '');
            Dom.text(this.view.tableMaxHighLow, '');
            Dom.text(this.view.tableMaxGap, '');
        }
    }
    view_selectStatsPeriod_changed(event) {
        event.preventDefault();
        app.settings.selectedPeriod = DataPeriod[this.view.selectStatsPeriod.value];
        this.resetStats();
    }
    setPropertiesTableBody(dataSet) {
        const tableRawHtml = '' +
            `<tr><td>Terminal     </td><td>${dataSet.terminal}</td></tr>` +
            `<tr><td>Company      </td><td>${dataSet.company}</td></tr>` +
            `<tr><td>Server       </td><td>${dataSet.server}</td></tr>` +
            `<tr><td>Symbol       </td><td>${dataSet.symbol}</td></tr>` +
            `<tr><td>Base currency</td><td>${dataSet.baseCurrency}</td></tr>` +
            `<tr><td>Price in     </td><td>${dataSet.priceIn}</td></tr>` +
            `<tr><td>Digits       </td><td>${dataSet.digits}</td></tr>` +
            `<tr><td>Point        </td><td>${dataSet.point.toFixed(dataSet.digits)}</td></tr>` +
            `<tr><td>Tick value   </td><td>${dataSet.tickValue.toFixed(dataSet.digits)}</td></tr>`;
        Dom.innerHtml(this.view.tableProperties, tableRawHtml);
    }
    setStatisticsTableBody(dataSet) {
        let maxHighLowPrice = 0;
        let maxCloseOpenPrice = 0;
        let sumHighLow = 0;
        let sumCloseOpen = 0;
        let sumGap = 0;
        let instrMaxGap = 0;
        let minPrice = Number.MAX_VALUE;
        let maxPrice = 0;
        let maxDaysOff = 0;
        for (let bar = 1; bar < dataSet.bars; bar++) {
            if (dataSet.high[bar] > maxPrice) {
                maxPrice = dataSet.high[bar];
            }
            if (dataSet.low[bar] < minPrice) {
                minPrice = dataSet.low[bar];
            }
            if (Math.abs(dataSet.high[bar] - dataSet.low[bar]) > maxHighLowPrice) {
                maxHighLowPrice = Math.abs(dataSet.high[bar] - dataSet.low[bar]);
            }
            sumHighLow += Math.abs(dataSet.high[bar] - dataSet.low[bar]);
            if (Math.abs(dataSet.close[bar] - dataSet.open[bar]) > maxCloseOpenPrice) {
                maxCloseOpenPrice = Math.abs(dataSet.close[bar] - dataSet.open[bar]);
            }
            sumCloseOpen += Math.abs(dataSet.close[bar] - dataSet.open[bar]);
            const oneDay = 24 * 60 * 60 * 1000;
            const dayDiff = Math.round((dataSet.time[bar] - dataSet.time[bar - 1]) / oneDay);
            if (maxDaysOff < dayDiff) {
                maxDaysOff = dayDiff;
            }
            const gap = Math.abs(dataSet.open[bar] - dataSet.close[bar - 1]);
            sumGap += gap;
            if (instrMaxGap < gap) {
                instrMaxGap = gap;
            }
        }
        const averageGap = Math.round(sumGap / ((dataSet.bars - 1) * dataSet.point));
        const maxGap = Math.round(instrMaxGap / dataSet.point);
        const averageHighLow = Math.round(sumHighLow / ((dataSet.bars - 1) * dataSet.point));
        const maxHighLow = Math.round(maxHighLowPrice / dataSet.point);
        const averageCloseOpen = Math.round(sumCloseOpen / ((dataSet.bars - 1) * dataSet.point));
        const maxCloseOpen = Math.round(maxCloseOpenPrice / dataSet.point);
        const tableRawHtml = '' +
            `<tr><td>Minimum price       </td><td>${minPrice}</td></tr>` +
            `<tr><td>Maximum price       </td><td>${maxPrice}</td></tr>` +
            `<tr><td>Average gap         </td><td>${averageGap}</td></tr>` +
            `<tr><td>Maximum gap         </td><td>${maxGap}</td></tr>` +
            `<tr><td>Average High - Low  </td><td>${averageHighLow}</td></tr>` +
            `<tr><td>Maximum High - Low  </td><td>${maxHighLow}</td></tr>` +
            `<tr><td>Average Close - Open</td><td>${averageCloseOpen}</td></tr>` +
            `<tr><td>Maximum Close - Open</td><td>${maxCloseOpen}</td></tr>` +
            `<tr><td>Maximum days off    </td><td>${maxDaysOff}</td></tr>`;
        Dom.innerHtml(this.view.tableStatistics, tableRawHtml);
    }
    setMaxDaysOffTableBody(dataSet) {
        const statsData = [];
        for (let i = 1; i < dataSet.bars; i++) {
            statsData.push({
                time: dataSet.time[i],
                val: dataSet.time[i] - dataSet.time[i - 1],
            });
        }
        statsData.sort((a, b) => b.val - a.val > 0 ? 1 : -1);
        const contentHtml = statsData.slice(0, 9)
            .map((e) => {
            return '<tr>' +
                `<td>${DataHelper.barTimeToString(e.time)}</td>` +
                `<td>${(e.val / (24 * 60 * 60 * 1000)).toFixed(2)}</td>` +
                '</tr>';
        })
            .join('\r\n');
        Dom.innerHtml(this.view.tableMaxDaysOff, contentHtml);
    }
    setMaxCloseOpenTableBody(dataSet) {
        const statsData = [];
        for (let i = 0; i < dataSet.bars; i++) {
            statsData.push({
                time: dataSet.time[i],
                val: Math.abs(dataSet.close[i] - dataSet.open[i]),
            });
        }
        statsData.sort((a, b) => b.val - a.val > 0 ? 1 : -1);
        const contentHtml = statsData.slice(0, 9)
            .map((e) => {
            return '<tr>' +
                `<td>${DataHelper.barTimeToString(e.time)}</td>` +
                `<td>${Math.round(e.val / dataSet.point).toString()}</td>` +
                '</tr>';
        })
            .join('\r\n');
        Dom.innerHtml(this.view.tableMaxCloseOpen, contentHtml);
    }
    setMaxHighLowTableBody(dataSet) {
        const statsData = [];
        for (let i = 0; i < dataSet.bars; i++) {
            statsData.push({
                time: dataSet.time[i],
                val: Math.abs(dataSet.high[i] - dataSet.low[i]),
            });
        }
        statsData.sort((a, b) => b.val - a.val > 0 ? 1 : -1);
        const contentHtml = statsData.slice(0, 9)
            .map((e) => {
            return '<tr>' +
                `<td>${DataHelper.barTimeToString(e.time)}</td>` +
                `<td>${Math.round(e.val / dataSet.point).toString()}</td>` +
                '</tr>';
        })
            .join('\r\n');
        Dom.innerHtml(this.view.tableMaxHighLow, contentHtml);
    }
    setMaxGapTableBody(dataSet) {
        const statsData = [];
        for (let i = 1; i < dataSet.bars; i++) {
            statsData.push({
                time: dataSet.time[i],
                val: Math.abs(dataSet.open[i] - dataSet.close[i - 1]),
            });
        }
        statsData.sort((a, b) => b.val - a.val > 0 ? 1 : -1);
        const contentHtml = statsData.slice(0, 9)
            .map((e) => {
            return '<tr>' +
                `<td>${DataHelper.barTimeToString(e.time)}</td>` +
                `<td>${Math.round(e.val / dataSet.point).toString()}</td>` +
                '</tr>';
        })
            .join('\r\n');
        Dom.innerHtml(this.view.tableMaxGap, contentHtml);
    }
}
class AcquisitionView {
    constructor() {
        this.selectFormat = Dom.gebid('select-format');
        this.acquisitionTable = Dom.gebid('table-acquisition');
    }
}
class ApplicationView {
    constructor() {
        this.selectSymbol = Dom.gebid('select-symbol');
        this.btnLoadData = Dom.gebid('btn-load-data');
        this.linkSwitch = Dom.gebcn('panel-switch');
        this.toolPanel = Dom.gebcn('tool-panel');
    }
}
class ChartView {
    constructor() {
        this.canvasIndicatorChart = Dom.gebid('price-chart-canvas');
        this.indicatorChartInfoPanel = Dom.gebid('price-chart-info-panel');
        this.selectChartPeriod = Dom.gebid('select-chart-period');
        this.window = window;
    }
}
class PreviewView {
    constructor() {
        this.selectPreviewPeriod = Dom.gebid('select-preview-period');
        this.tableDataPreview = Dom.gebid('table-data-preview');
    }
}
class SettingsView {
    constructor() {
        this.selectMaxBars = Dom.gebid('select-max-bars');
        this.selectTimezone = Dom.gebid('select-timezone');
        this.inputPrefix = Dom.gebid('input-prefix');
        this.inputSuffix = Dom.gebid('input-suffix');
        this.inputServer = Dom.gebid('input-server');
        this.btnReset = Dom.gebid('btn-reset-settings');
    }
}
class StatsView {
    constructor() {
        this.selectStatsPeriod = Dom.gebid('select-stats-period');
        this.tableMaxDaysOff = Dom.gebid('table-max-days-off');
        this.tableProperties = Dom.gebid('table-properties');
        this.tableStatistics = Dom.gebid('table-statistics');
        this.tableMaxCloseOpen = Dom.gebid('table-max-close-open');
        this.tableMaxHighLow = Dom.gebid('table-max-high-low');
        this.tableMaxGap = Dom.gebid('table-max-gap');
    }
}
