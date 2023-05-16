// Button per source panel (BPS)
// Utah Scientific
//

var tcp = require('../../tcp')
var instance_skel = require('../../instance_skel')
const { each } = require('lodash')
const { parseVariablesInString } = require('../../lib/variable')

var debug
var log

function instance(system) {
	var self = this

	// super-constructor
	instance_skel.apply(this, arguments)

	self.actions()

	return self
}

instance.prototype.updateConfig = function (config) {
	var self = this

	console.log('update config')

	self.config = config

	self.setupVariables()
	self.setupFeedbacks()
	self.actions()

	self.init_tcp()
}

instance.prototype.init = function () {
	var self = this

	debug = self.debug
	log = self.log

	self.setupVariables()
	self.setupFeedbacks()
	self.actions()
	//self.initPresets()

	self.checkFeedbacks('selected_dest')
	self.checkFeedbacks('selected_source')

	self.init_tcp()
}

instance.prototype.destroy = function () {
	// When module gets deleted
	var self = this

	if (self.socket !== undefined) {
		if (self.pingtimer != 0) {
			clearInterval(self.pingtimer)
			self.pingtimer = 0
		}
		self.socket.destroy()
	}

	debug('destroy', self.id)
}

instance.prototype.setupVariables = function () {
	var self = this

	// Implemented Commands
	self.commands = []
	self.pingtimer = 0
	self.datastate = 0
	self.dbuf = Buffer.from('')
	// Hold values
	self.selected_level = []
	self.selected_dest = -1
	self.selected_source = -1
	

	if (self.routerTablemap == undefined)
		self.routerTablemap = new Map()

	// Labels
	self.source_names = []
	self.dest_names = []
	self.updateVariableDefinitions()

	self.setVariable('Sources', 0)
	self.setVariable('Destinations', 0)

	self.setVariable('Source', self.selected_source)
	self.setVariable('Destination', self.selected_dest)
}

instance.prototype.updateVariableDefinitions = function () {
	var self = this
	var coreVariables = []
	//var variableValues= []

	self.setVariable('Sources', self.source_names.length)
	self.setVariable('Destinations', self.dest_names.length)

	coreVariables.push(
		{
			label: 'Number of source names returned by router',
			name: 'Sources',
		},
		{
			label: 'Number of destination names returned by router',
			name: 'Destinations',
		},
		{
			label: 'Selected destination',
			name: 'Destination',
		},
		{
			label: 'Selected source',
			name: 'Source',
		}
	)

	for (var i = 0; i < Object.keys(self.source_names).length; i++) {
		coreVariables.push({
			label: 'Source ' + i.toString(),
			name: 'Source_' + i.toString(), //self.source_names[i].label, // 'Source_' + i.toString(), 
		})
		self.setVariable('Source_' + i.toString(),self.source_names[i].label	) //variableValues['Source_' + i.toString()] = self.source_names[i].label	
	}

	for (var i = 0; i < Object.keys(self.dest_names).length; i++) {
		coreVariables.push({
			label: 'Destination ' + i.toString(),
			name: 'Destination_' + i.toString(),
		})
		self.setVariable('Destination_' + i.toString(), self.dest_names[i].label) //variableValues['Destination_' + i.toString()] = self.dest_names[i].label	
	} 

	/*for (const input of state.iterateInputs()) {
		if (input.status != 'None') {
			variableDefinitions.push({
				name: `Label of input ${input.id + 1}`,
				variableId: `input_${input.id + 1}`,
			})

			variableValues[`input_${input.id + 1}`] = input.name
		}
	}

	for (const output of state.iterateAllOutputs()) {
		if (output.status != 'None') {
			variableDefinitions.push({
				name: `Label of output ${output.id + 1}`,
				variableId: `output_${output.id + 1}`,
			})

			variableValues[`output_${output.id + 1}`] = output.name

			variableDefinitions.push({
				name: `Label of input routed to output ${output.id + 1}`,
				variableId: `output_${output.id + 1}_input`,
			})

			variableValues[`output_${output.id + 1}_input`] = state.getInput(output.route)?.name ?? '?'
		}
	}*/

	self.setVariableDefinitions(coreVariables)
	
	// var labelDump = {}

	// for (var i = 0; i < Object.keys(self.source_names).length; i++) {
	// 	var variableName = 'Source_' + self.source_names[i].id
	// 	var variableValue = self.stripNumber(self.source_names[i].label)
	// 	labelDump[variableName] = variableValue
	// }

	// for (var i = 0; i < Object.keys(self.dest_names).length; i++) {
	// 	var variableName = 'Destination_' + self.dest_names[i].id
	// 	var variableValue = self.stripNumber(self.dest_names[i].label)
	// 	labelDump[variableName] = variableValue
	// }

	// console.log(labelDump)
	//self.setVariables(labelDump)
}

instance.prototype.doStatusUpdate= function (src, dst) 
{ 
	var self=this
	self.routerTablemap.set(dst, src)
	console.log(self.config.label + "::doStatusUpdate: SRC: " + src + ", to DST: " + dst)
	self.checkFeedbacks('selected_dest')
	self.checkFeedbacks('selected_source')
}

instance.prototype.setupDstList= function () 
{
	var self=this
	self.dest_names=[]
	self.dst_nameidmap.forEach(( value, key) => 
	{
		self.dest_names.push ({label:key, id:value })
	})
	self.dest_names.sort((a, b) => {
		if (a.label > b.label) return 1;
		if (a.label < b.label) return -1;
		return 0;
	})
}

instance.prototype.setupSrcList= function () 
{
	var self=this
	self.source_names=[]
	self.src_nameidmap.forEach(( value, key) => 
	{
		self.source_names.push ({label:key, id:value})
	}) 
	self.source_names.sort((a, b) => {
		if (a.label > b.label) return 1;
		if (a.label < b.label) return -1;
		return 0;
	})
}

instance.prototype.setupPresetList= function () 
{
	var self = this
	console.log(self.config.label + "::setupPresetList")
	self.initPresets()
	self.updateVariableDefinitions()
	self.setupFeedbacks()
	self.actions()
}

instance.prototype.doSC4init= function () 
{
	var self = this
	console.log(self.config.label + "::doSC4init()")
	self.srcCount = 0
	self.dstCount = 0
	self.statusCount = 0

	if (self.src_idinfomap == undefined)
		self.src_idinfomap = new Map()
	
	if (self.dst_idinfomap == undefined)
		self.dst_idinfomap = new Map()

	if (self.src_nameidmap == undefined)
		self.src_nameidmap = new Map()

	if (self.dst_nameidmap == undefined)
		self.dst_nameidmap = new Map()

	if (self.router_statusmap == undefined)
		self.router_statusmap = new Map()

	self.src_idinfomap.clear()
	self.src_nameidmap.clear()
	self.dst_idinfomap.clear()
	self.dst_nameidmap.clear()
	self.router_statusmap.clear()

	self.sendGetDestinationList()
	self.sendGetSourceList()
	self.sendGetRouterStatus()
	self.sendVerbosity()
}

instance.prototype.doPing= function () 
{
	var self = this
	console.log(self.config.label + "::doPing()")
	if (self.pingtimer != 0) {
		clearInterval(self.pingtimer)
		self.pingtimer = 0
		console.log(self.config.label + '::Stop ping timer')
	}

	var pingcallback = () =>
	{
		var self = this
		//console.log(self.config.label + "::Ping Timer")				
		self.sendPing()	
	};
	self.pingtimer = setInterval(pingcallback, 5000)
}

instance.prototype.parseCommand_Control= function (hdrcommand, dmsg) 
{
	var self = this
	switch(hdrcommand)
    {
	case 254: // RCP4_Control_Ping_Command:        /* takes, status, locks, etc */
        
        break
    case 253: // RCP4_Control_Ping_Status:        /* takes, status, locks, etc */
        console.log(self.config.label + "::Ping response")
        break;
    default:
        debug(self.config.label + "::Unknown control command: " + hdrcommand)
        break
    }
}

instance.prototype.parseDevInfo = function (d) 
{
	var self = this
	var devType = (d[0] <<  8) + d[1]
	var devIdx = (d[2] << 8) + d[3]
	var devName = ''
	var pos = 4
	for (var j = 0; j < 10; j++) 
	{
		if (d[pos] == 0)
			devName += ' '
		else 
			devName = devName + String.fromCharCode(d[pos])
		pos++
	}
	pos += 2
	devName = devName.trim()
	var levels = new Int16Array(16)
	for (var j = 0; j < 16; j++) 
	{
		levels[j] = (d[pos] << 8) + d[pos + 1]
		pos += 2
	}

	if (devType == 0) // source
	{
		self.srcCount ++
		self.src_nameidmap.set(devName, devIdx)
		self.src_idinfomap.set(devIdx, {name: devName, levels: levels})
	}
	else if (devType == 1) // destination
	{
		self.dstCount ++
		self.dst_nameidmap.set(devName, devIdx)
		var levActive=-1;
		for(var i=0; i<16; i++)
		{
			if(levels[i]>-1)
			{
				levActive=i;
				break;
			}
		}

		self.dst_idinfomap.set(devIdx, {name: devName, levels: levels, levActive:levActive})
	}
	else
	{
		console.log(self.config.label + "::Unknown dev type: " + devType)
	}
}

instance.prototype.parseLevelInfo = function (d) 
{
	var self = this	
	var levelIdx = d[0]
	var levelName = ''
	var pos = 1
	for (var j = 0; j < 10; j++) 
	{
		if (d[pos] == 0)
			levelName += ' '
		else 
			levelName = levelName + String.fromCharCode(d[pos])
		pos++
	}
	pos += 2
	levelName = levelName.trim()
	var levelType = d[pos]
}

instance.prototype.parseCommand_Sc4 = function (hdrcommand, dmsg) 
{
	var self = this
	switch(hdrcommand)
    {
    case 14: // RCP4_SC4_DevTable_Response:             /* name table downloads */
		//console.log("router source/destination")
		self.parseDevInfo(dmsg)
        break
    case 38: // RCP4_SC4_DevTable_Done_Output:
        console.log(self.config.label + "::router destination list end, dstcount: " + self.dstCount)
		//self.emit('dstlistdone')
		self.setupDstList()
        break
    case 39: // RCP4_SC4_DevTable_Done_Input:
        console.log(self.config.label + "::router source list end, srccount: " + self.srcCount)
		//self.emit('srclistdone')
		self.setupSrcList()
        break

    case 9: // RCP4_SC4_Level_Response:
		console.log(self.config.label + "::router level info")
		self.parseLevelInfo(dmsg)
        break
    default:
        debug(self.config.label + "::Unknown SC4 command: " + hdrcommand)
        break
    }
}

instance.prototype.parseMatrixInfo = function (d) 
{
	var self = this	
	var src = (d[0] << 8) + d[1]
	var dst = (d[2] << 8) + d[3]
	var lev = (d[4] << 24) + (d[5] << 16) + (d[6] << 8) + d[7]

	var levels=self.router_statusmap.get(dst)
	var bit = 0x01
	/*var slevels=self.src_idinfomap.get(src).levels
	
	if (lev==0)  //VE  set all levels to blank that matched the levels in the src.  this is the case of status after disconnect
	{
		for (var j = 0; j < 16; j++)
		{
			if(levels[j] > -1 && slevels[j] > -1)	
			{
				levels[j]=0xFFFFFFFF
			}
		}
	}
	else{*/

		for (var j = 0; j < 16; j++, bit <<= 1)
		{
			if (lev & bit)
				levels[j] = src 
		} 
	//}
	
	self.router_statusmap.set(dst, levels)
	self.doStatusUpdate(src, dst)
	self.checkFeedbacks('source_dest_route')
	self.checkFeedbacks('combo_bg')

}

instance.prototype.parseMatrixDump = function (d) 
{
	var self = this	
	var startOut = (d[0] << 8) + d[1]
	var numOut = (d[2] << 8) + d[3]

	var pos = 4
	for (var i = 0; i < numOut; i++)
	{
		var idx = i + startOut
		var levels = new Int32Array(32)
		for (var j = 0; j < 32; j++)
		{
			levels[j] = (d[pos] << 8) + d[pos+1]	
			if(levels[j]==4095)
			{
				levels[j]=0xffffffff
			}
			pos += 2		
		}
		self.router_statusmap.set(idx, levels)
	}
	self.statusCount += numOut
	//console.log("startOut: " + startOut + ", numOut: " + numOut)
	self.checkFeedbacks('source_dest_route')
	self.checkFeedbacks('combo_bg')
}

instance.prototype.parseCommand_Unet = function (hdrcommand, dmsg) 
{
	var self = this
	switch (hdrcommand)
	{
	case 65: // RCP4_UNet_Matrix_Response_Chunk_WEND:         /* router status dump */
		//console.log("router matrix status dump")
		self.parseMatrixDump(dmsg)
		break
	case 95: // RCP4_UNet_XPT_Status:
		console.log(self.config.label + "::router matrix status")
		self.parseMatrixInfo(dmsg)
		break
	case 66: // RCP4_UNet_Matrix_Response_Chunk_End:
        console.log(self.config.label + "::router matrix status end, processed count: " + self.statusCount + ", map count: " + self.router_statusmap.size)
        //self.emit('statusdumpdone')
		self.setupPresetList()
		break
    case 171: // RCP4_UNet_Numeric_Status:
		break
    case 1: // RCP4_UNet_XPT_Reply:
		break
	default:
		debug(self.config.label + "::Unknown UNET command: " + hdrcommand)
		break
	}
}

instance.prototype.processCmd = function (hdrinterface, hdrcommand, hdrmode, dmsg) 
{
	var self = this
	switch(hdrinterface)
    {
    case 18: // RCP4_UNet:        /* takes, status, locks, etc */
        self.parseCommand_Unet(hdrcommand, dmsg)
        break
    case 128: // RCP4_SC4:         /* src / dest downloads */
        self.parseCommand_Sc4(hdrcommand, dmsg)
        break
    case 4: // RCP4_Socket:      /* verbosity command */
        //parseCommand_Socket(hdr, dataBuf, rcpMsgListPtr);
        break
    case 3: // RCP4_Control:     /* ping commands */
        self.parseCommand_Control(hdrcommand, dmsg)
        break
    default:
		debug(self.config.label + "::Unknown RCP3 interface: " + hdrinterface)
        break
    }
}

instance.prototype.decodeData= function (data) 
{
	var self = this
	//var arr = [self.dbuf, data]
	var dd = Buffer.concat([self.dbuf, data])
	var done = false;
	var rcp3hdrlen = 6
	var startpos = 0
	var hdrinterface = 0
	var hdrcommand = 0
	var hdrmode = 0
	var hdrpadding = 0
	var hdrdatalen = 0

	while (!done)
	{
		switch (self.datastate)
		{
		case 0:
			if (dd.length < (startpos + rcp3hdrlen))
			{
				done = true;
			}
			else
			{
				hdrinterface = dd[startpos + 0]
				hdrcommand = dd[startpos + 1]
				hdrmode = dd[startpos + 2]
				hdrpadding = dd[startpos + 3]
				hdrdatalen = (dd[startpos + 4] << 8) + dd[startpos + 5]
				
				if (startpos + hdrdatalen > dd.length)
				{
					done = true
				}
				else
				{
					self.datastate = 1
					startpos += 6
				}
			}
			break
		case 1:
			{
				var dmsg = []
				if (hdrdatalen > 0)
					dmsg = dd.subarray(startpos, startpos + hdrdatalen)
				startpos += hdrdatalen
				self.datastate = 0
				self.processCmd(hdrinterface, hdrcommand, hdrmode, dmsg)
			}
			break

		default:
			debug(self.config.label + "::Unknown decode data state: " + self.datastate)
			break
		}
	}
	self.dbuf = dd.subarray(startpos)
}

instance.prototype.init_tcp = function () {
	var self = this
	var receivebuffer = Buffer.from('')

	if (self.socket !== undefined) {
		self.socket.destroy()
		delete self.socket
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, self.config.port)

		self.socket.on('status_change', function (status, message) {
			self.status(status, message)
		})

		self.socket.on('error', function (err) {
			debug('Network error', err)
			self.log('error', 'Network error: ' + err.message)
		})

		self.socket.on('connect', function () {
			debug('Connected')
			self.doSC4init()
			self.doPing()			
		})

		self.socket.on('data', function (chunk) {
			self.decodeData(chunk)
		})
	}
}

instance.prototype.config_fields = function () {
	var self = this

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module will allow you to control Utah Scientific Routers via an SC4, SC400, UDS, etc.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Router Controller IP',
			width: 6,
			regex: self.REGEX_IP,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Port',
			width: 6,
			default: '5001',
			regex: self.REGEX_PORT,
		},
	]
}

instance.prototype.setupFeedbacks = function (system) {
	var self = this

	// feedback
	var feedbacks = {}
	CompanionTextSize = '18'

	feedbacks['selected_dest'] = {
		type: 'boolean',
		label: 'Selected Destination',
		description: 'Change colour of button on selected destination',
		style: {
			color: self.rgb(0, 0, 0),
			bgcolor: self.rgb(102, 255, 102),
			//VE try here to add something to the button text
			//text: this.text + '\n' + selected_routed_source_str,
			size: CompanionTextSize 
		},
		options: [
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'dest',
				default: 0, //self.selected_dest
				choices: self.dest_names,
			},
		],
	}

	feedbacks['selected_source'] = {
		type: 'boolean',
		label: 'Selected Source',
		description: 'Change colour of button on selected source',
		style: {
			color: self.rgb(0, 0, 0),
			bgcolor: self.rgb(102, 255, 255),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: 0, //self.selected_source,
				choices:self.source_names,
			},
		],
	}

	feedbacks['source_dest_route'] = {
		type: 'boolean',
		label: 'Source Routed to Destination',
		description: 'Change button colour when this source is routed to selected destination on any level',
		style: {
			color: self.rgb(0, 0, 0),
			bgcolor: self.rgb(255, 191, 128),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: 0,//self.selected_source,
				choices:self.source_names,
			},
		],
	} 

	feedbacks['combo_bg'] = {
		type: 'boolean', //'advanced',
		label: 'Change background color by destination',
		description: 'If the set Source is in use by the set Destination, change background color of the button',
		style: {
			color: self.rgb(0, 0, 0),
			bgcolor: self.rgb(64,64, 255),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: 0,
				choices: self.source_names,
			},
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'dest',
				default: 0,
				choices: self.dest_names,
			},
			/*{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: combineRgb(0, 0, 0),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: combineRgb(255, 255, 0),
			},*/
		],
		
	} 

	self.setFeedbackDefinitions(feedbacks)
}

instance.prototype.feedback = function (feedback, bank) {
	var self = this

	switch (feedback.type) {		
		case 'selected_dest': {
			console.log(self.config.label + "::feedback:selected_dest: selected_dest: " + self.selected_dest + ", option dest:" + feedback.options.dest)
			if (self.selected_dest === feedback.options.dest) 
			{
				return true
			} else {
				return false
			}
			break
		}

		case 'selected_source': {
			console.log(self.config.label + "::feedback:selected_source: selected_source: " + self.selected_source + ", option source:" + feedback.options.source)
			if (self.selected_source === feedback.options.source) {
				return true
			} else {
				return false
			}
			break
		}

		case 'source_dest_route': {
			
			//console.log('feedback:source_dest_route: selected_dest: ' + self.selected_dest + ':' + feedback.options.source)
			if(self.selected_dest>-1)
			{
				if(self.router_statusmap.has(self.selected_dest))
				{
					var levels=self.router_statusmap.get(self.selected_dest)
					var firstActive= self.dst_idinfomap.get(self.selected_dest).levActive
				
					if(firstActive>-1 )
					{
						if(levels[firstActive]===feedback.options.source)
						{
							return true
						} 
						else{
							return false
						}
					} 
				    else{ return false
						}
				}
			}
			return false
		} 

		case 'combo_bg': {
			console.log('---------------------------------feedback:combo_bg: set_dest: ' + feedback.options.dest + ':' + feedback.options.source)
			if(feedback.options.dest>-1)
			{
				if(self.router_statusmap.has(feedback.options.dest))
				{
					var levels=self.router_statusmap.get(feedback.options.dest)
					var firstActive= self.dst_idinfomap.get(self.selected_dest).levActive
					if(levels[firstActive]===feedback.options.source)
					{
						return  true
					} 
					else {
						return false//{}
					}
						
				} 
				else {
					return false //{}
				} 
			}
			else{
				return false//{}
			}
			
		}

	}
}

instance.prototype.initPresets = function () {
	var self = this
	var presets = []

	//self.setVariable('Source_' + i.toString(),self.source_names[i].label	) 
	
	

	for( var i=0; i<Object.keys(self.source_names).length; i++) { 
		var s='Source_' + i
		var srcname='$(' + self.label +':'+ s + ')'
		presets.push({
			category: 'Sources (by name)',
			label: 'Source ' + i,
			bank: {
				style: 'text',
				text: srcname, //self.source_names[i].label, 
				size: '14',
				color: self.rgb(255, 255, 255),
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'select_source_name',
					options: {
						source: self.source_names[i].id,
					},
				},
			],
			feedbacks: [
				{
					type: 'selected_source',
					options: {
						source:  self.source_names[i].id,
					},
					style: {
						color: self.rgb(0, 0, 0),
						bgcolor: self.rgb(102, 255, 255),
					},
				},
				{
					type: 'source_dest_route',
					options: {
						source:  self.source_names[i].id,
					},
					style: {
						color: self.rgb(0, 0, 0),
						bgcolor: self.rgb(255, 191, 128),
					},
				},
			],
		})
	}
	for (var i = 0; i < Object.keys(self.dest_names).length; i++) {
		var s='Destination_' + i
		var dstname='$(' + self.label +':'+ s + ')'
		presets.push({
			category: 'Destinations (by name)',
			label: 'Destination ' + i,
			bank: {
				style: 'text',
				text: dstname, //self.dest_names[i].label,
				size: '14',
				color: self.rgb(255, 255, 255),
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'select_dest_name',
					options: {
						dest: self.dest_names[i].id,
					},
				},
			],
			feedbacks: [
				{
					type: 'selected_dest',
					options: {
						dest: self.dest_names[i].id,
					},
					style: {
						color: self.rgb(0, 0, 0),
						bgcolor: self.rgb(102, 255, 102),
					},
				},
			],
		})
	}

//VE 01/17/23
//combo preset with actions needed for it
	presets.push(
		{
			category: 'SinglePressTakeBtn',
			label:'Combo Btn',
			bank: {
				style: 'text',
				text: '',
				size: '14',
				color: self.rgb(255, 255, 255),
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'route',
					options: {
						//source: self.source_names[i].id,
					},
				},
			],
			feedbacks: [
				{
					type: 'combo_bg',
					options: {
						//source:  self.source_names[i].id,
					},
					style: {
						color: self.rgb(0, 0, 0),
						bgcolor: self.rgb(255, 255, 128),
					},
				},
				
			],
		})


	self.setPresetDefinitions(presets)
}

instance.prototype.actions = function () {
	var self = this

	self.system.emit('instance_actions', self.id, {
		
		select_dest_name: {
			label: 'Select Destination name',
			options: [
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'dest',
					default: 1,
					choices: self.dest_names,
				},
			],
			
		},

		select_source_name: {
			label: 'Select Source name',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 1,
					choices: self.source_names,
				},
			],
		},


		route : {
			label: 'Single Press Take Src to Dst',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 0,
					choices: self.source_names,
				},
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'destination',
					
					choices: self.dest_names,
					default:0 ,//'Destination 0',// '',//0,//self.dest_names[0]?.id,
				},
			],
			
		},
	})
}

instance.prototype.action = function (action) {
	var self = this
	var prev_dest=self.selected_dest

	const opt = action.options

	if (action.action === 'select_dest_name') {
		self.selected_dest = parseInt(opt.dest)
		console.log('set destination ' + self.selected_dest)
		self.setVariable('Destination', self.selected_dest)
		self.checkFeedbacks('selected_dest')
		self.checkFeedbacks('source_dest_route')
		self.checkFeedbacks('combo_bg')
		return
	}

	if (action.action === 'select_source_name') {
		self.selected_source = parseInt(opt.source)
		console.log('set source TEST********** ' + self.selected_source)
		self.setVariable('Source', self.selected_source)
		self.checkFeedbacks('selected_source')
		self.checkFeedbacks('combo_bg')
		//VE check if we can send a take cmd
		if(self.selected_dest>=0)
		{
			console.log('sending take cmd', self.selected_source, self.selected_dest)			
			self.sendSingleTake(self.selected_source, self.selected_dest)
			self.selected_source=-1
		}
		return
	}
	if (action.action === 'route') {
		self.selected_dest = parseInt(opt.destination)
		console.log('set destination ' + self.selected_dest)
		self.setVariable('Destination', self.selected_dest)
		self.checkFeedbacks('selected_dest')
		self.checkFeedbacks('source_dest_route')
	
		self.selected_source = parseInt(opt.source)
		console.log('set source TEST********** ' + self.selected_source)
		self.setVariable('Source', self.selected_source)
		self.checkFeedbacks('selected_source')
		//VE check if we can send a take cmd
		if(self.selected_dest>=0)
		{
			console.log('sending take cmd', self.selected_source, self.selected_dest)			
			self.sendSingleTake(self.selected_source, self.selected_dest)
			self.selected_source=-1
			//self.selected_dest=prev_dest
			self.checkFeedbacks('combo_bg')
		}

		return
	}
	//action.internal.
}

// byte[] tcpHeader = new byte[] { 0x03, 0xFE, 0, 0, 0, 0 };
instance.prototype.sendPing = function () {
	var self = this

	//console.log('Sending PING')
	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(self.hexStringToBuffer('03FE00000000'))
	} else {
		debug('Socket not connected :(')
	}
}

// byte[] tcpHeader = new byte[] { 0x03, 0xFE, 0, 0, 0, 0 };
instance.prototype.sendPingResp = function () {
	var self = this

	console.log('Sending PING RESP')
	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(self.hexStringToBuffer('03FD00000000'))
	} else {
		debug('Socket not connected :(')
	}
}

// byte[] tcpHeader = new byte[] { 0x04, 0, 0x02, 0, 0, 2, 0, 0x02 };
instance.prototype.sendVerbosity= function () {
	var self = this

	console.log(self.config.label + '::Sending VERBOSITY')
	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(self.hexStringToBuffer('0400020000020002'))
	} else {
		debug('Socket not connected :(')
	}
}

// byte[] command = new byte[] { 0x80, 0x0D, 0, 0, 0, 0x01, 0x00 };
instance.prototype.sendGetSourceList= function () {
	var self = this

	console.log(self.config.label + '::Sending GET SOURCE LIST')
	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(self.hexStringToBuffer('800D0000000100'))
	} else {
		debug('Socket not connected :(')
	}
}

// byte[] command = new byte[] { 0x80, 0x0D, 01, 0, 0, 0x01, 0x01 };
instance.prototype.sendGetDestinationList= function () {
	var self = this

	console.log(self.config.label + '::Sending GET DESTINATION LIST')
	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(self.hexStringToBuffer('800D0100000101'))
	} else {
		debug('Socket not connected :(')
	}
}

// byte[] tcpHeader = new byte[] { 0x12, 0x40, 0, 0, 0, 0 };
instance.prototype.sendGetRouterStatus= function () {
	var self = this

	console.log(self.config.label + '::Sending GET ROUTER STATUS')
	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(self.hexStringToBuffer('124000000000'))
	} else {
		debug('Socket not connected :(')
	}
}

// byte[] tcpHeader = new byte[] { 0x80, 0x08, (idx & 0xFF), 0, 0, 1, (idx & 0xFF)};
instance.prototype.sendGetLevelInfo= function (idx) {
	var self = this

	console.log(self.config.label + '::Sending GET LEVEL INFO at IDX: ' + idx)
	if (self.socket !== undefined && self.socket.connected)
	{
		var index = idx & 0xFF
		var x = self.padLeft(index.toString(16), 2)
		self.socket.send(self.hexStringToBuffer('8008' + x + '000001' + x))
	} else {
		debug('Socket not connected :(')
	}
}

// byte[] tcpHeader = new byte[] { 0x12, 0x00, (chksum & 0xFF), 0, 0, 8, (src & 0xFFFF), (dst & 0xFFFF), (lvl & 0xFFFFFFFF)};
instance.prototype.sendSingleTake= function (src, dst) {
	var self = this

	console.log(self.config.label + '::Sending TAKE at SRC: ' + src + " DST: " + dst)
	if (self.socket !== undefined && self.socket.connected)
	{
		if (self.src_idinfomap.has(src) && self.dst_idinfomap.has(dst))
		{
			var srcidx = src & 0xFFFF
			var s = self.padLeft(srcidx.toString(16), 4)
			var dstidx = dst & 0xFFFF
			var d = self.padLeft(dstidx.toString(16), 4)
			var sl = self.src_idinfomap.get(src).levels
			var dl = self.dst_idinfomap.get(dst).levels
			var levelbits = 0;
			for (var i = 0; i < 16; i++)
			{
				if ((sl[i] != -1) && (dl[i] != -1))
				{
					levelbits |= 0x01 << i;
				}
			}
			var lvlbit = levelbits & 0xFFFFFFFF
			var l = self.padLeft(lvlbit.toString(16), 8)
			var ss = s + d + l
			var b = self.hexStringToBuffer(ss)
			var cksum = 0
			for (var i = 0; i < 8; i++)
			{
				cksum += b[i]
			}
			var m = self.padLeft(cksum.toString(16), 2)
			self.socket.send(self.hexStringToBuffer('1200' + m + '000008' + ss))
		}
	} else {
		debug('Socket not connected :(')
	}
}


instance.prototype.stripNumber = function (str) {
	var n = str.indexOf(':')
	if (n > 0) {
		return str.slice(n + 2)
	} else {
		return str
	}
}
instance.prototype.padLeft = function (nr, n, str) {
	if (n < String(nr).length)
	{
		var s = String(nr).slice(-n).split()
		return s
	}	
	else
		return Array(n - String(nr).length + 1).join(str || '0') + nr
}

instance.prototype.hexStringToBuffer = function (str) {
	return Buffer.from(str, 'hex')
}

instance.prototype.takeCmd = function (srcname, dstname) {
	// convert input value to upper case
	if (self.src_nameidmap.has(srcname) && self.dst_nameidmap.has(dstname))
	{	
		var srcidx = self.src_nameidmap.get(srcname)
		var dstidx = self.dst_nameidmap.get(dstname)
		self.sendSingleTake(srcidx, dstidx)
	}
}

instance_skel.extendedBy(instance)
exports = module.exports = instance
