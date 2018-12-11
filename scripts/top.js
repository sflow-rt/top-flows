// author: InMon Corp.
// version: 1.0
// date: 9/26/2014
// description: Top Flows
// copyright: Copyright (c) 2015 InMon Corp. ALL RIGHTS RESERVED

var SEP = '_SEP_';

var defaultShortcuts = [
{category:'Traffic', protocol:'IP', description:'Sources',keys:'ipsource',value:'bps',filter:''},
{category:'Traffic', protocol:'IP', description:'Destinations',keys:'ipdestination',value:'bps',filter:''},
{category:'Traffic', protocol:'IP', description:'Source-Destination pairs',keys:'ipsource,ipdestination',value:'bps',filter:''},
{category:'Traffic', protocol:'IPv6', description:'Sources',keys:'ip6source',value:'bps',filter:''},
{category:'Traffic', protocol:'IPv6', description:'Destinations',keys:'ip6destination',value:'bps',filter:''},
{category:'Traffic', protocol:'IPv6', description:'Source-Destination pairs',keys:'ip6source,ip6destination',value:'bps',filter:''},
{category:'Traffic', protocol:'Ethernet', description:'Sources',keys:'macsource,oui:macsource:name',value:'frames',filter:''},
{category:'Traffic', protocol:'Ethernet', description:'Sources of broadcasts',keys:'macsource,oui:macsource:name',value:'frames',filter:'macdestination=FFFFFFFFFFFF'},
{category:'Security', protocol:'TCP', description:'Connection attempts',keys:'ipsource,ipdestination,tcpdestinationport',value:'frames',filter:'tcpflags~.......1.'},
{category:'Security', protocol:'ARP', description:'Source of requests',keys:'arpipsender',value:'requests',filter:'arpoperation=1'},
{category:'Security', protocol:'DNS', description:'Requested domains',keys:'dnsqname',value:'requests',filter:''},
{category:'Security', protocol:'DNS', description:'Clients',keys:'or:ipsource:ip6source',value:'requests',filter:'dnsqr=false'},
{category:'Security', protocol:'DNS', description:'Servers',keys:'or:ipsource:ip6source',value:'requests',filter:'dnsqr=true'},
{category:'Security', protocol:'ICMP', description:'Unreachable ports', keys:'ipdestination,icmpunreachableport', value:'fps', filter:''},
{category:'Security', protocol:'ICMP', description:'Unreachable protocols', keys:'ipdestination,icmpunreachableprotocol', value:'fps', filter:''},
{category:'Security', protocol:'ICMP', description:'Unreachable hosts', keys:'ipdestination,icmpunreachablehost', value:'fps', filter:''},
{category:'Security', protocol:'ICMP', description:'Unreachable networks', keys:'ipdestination,icmpunreachablenet', value:'fps', filter:''},
{category:'Virtualization', protocol:'VxLAN', description:'Tenant VNI', keys:'vxlanvni',value:'bps',filter:''},
{category:'Virtualization', protocol:'NVGRE', description:'Tenant VSID', keys:'grevsid', value:'bps',filter:''},
{category:'Virtualization', protocol:'Geneve', description:'Tenant VNI', keys:'genevevni',value:'bps',filter:''}
];

var aggMode  = getSystemProperty('top-flows.aggMode')  || 'max';
var maxFlows = getSystemProperty('top-flows.maxFlows') || 20;
var minValue = getSystemProperty('top-flows.minValue') || 0.01;
var agents   = getSystemProperty('top-flows.agents')   || 'ALL';
var t        = getSystemProperty('top-flows.t')        || 2;
 
var shortcuts = storeGet('shortcuts') || defaultShortcuts;

var userFlows = {};

function escapeRegExp(str) {
  // seems like a bug - Rhino doesn't convert Java strings into native JavaScript strings
  str = new String(str);
  return str ? str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") : null;
}

var specID = 0;
function flowSpecName(keys,value,filter) {
  var keysStr = keys ? keys.join(',') : '';
  var valueStr = value ? value.join(',') : '';
  var filterStr = filter ? filter.join('&') : '';

  if(keysStr.length === 0 || valueStr.length === 0) return null;

  var key = keysStr || '';
  if(valueStr) key += '#' + valueStr;
  if(filterStr) key += '#' + filterStr;
  var entry = userFlows[key];
  if(!entry) {
    // try to create flow
    var name = 'top_flows_' + specID;
    try {
      setFlow(name,{keys:keysStr, value:valueStr, filter: filterStr.length > 0 ? filterStr : null, t:t, n:10, fs:SEP});
      entry = {name:name};
      userFlows[key] = entry;
      specID++;
    } catch(e) {
      entry = null;
    }
  }
  if(!entry) return null;
  entry.lastQuery = (new Date()).getTime();

  return entry.name;
}

function deleteUserFlows(now) {
  var key, entry;
  for(key in userFlows) {
    entry = userFlows[key];
    if(now - entry.lastQuery > 10000) {
      clearFlow(entry.name);
      delete userFlows[key];
    }
  }
}

setIntervalHandler(function(now) {
  deleteUserFlows(now);
},10);

function validShortcuts(obj) {
  if(!Array.isArray(obj)) return false;
  var attrs = ['category','protocol','description','keys','value','filter'];
  for(var i = 0; i < obj.length; i++) {
    let shortcut = obj[i];
    for(var j = 0; j < attrs.length; j++) {
      let attr = attrs[j];
      if(!shortcut.hasOwnProperty(attr)) return false;
      if(typeof shortcut[attr] !== 'string') return false;
    }
  }
  return true;
}

setHttpHandler(function(req) {
  var result, key, name, path = req.path;
  if(!path || path.length === 0) throw "not_found";
     
  switch(path[0]) {
  case 'shortcuts':
    if(path.length > 1) throw "not_found";
    switch(req.method) {
    case 'POST':
    case 'PUT':
      if(req.error) throw "bad_request";
      if(!validShortcuts(req.body)) throw "bad_request";
        shortcuts = req.body;
	storeSet('shortcuts', shortcuts);
	break;
    default: return shortcuts;
    }
    break;
  case 'flowkeys':
    if(path.length > 1) throw "not_found";
    result = [];
    var search = req.query['search'];
    if(search) {
      var matcher = new RegExp('^' + escapeRegExp(search), 'i');
      for(key in flowKeys()) {
        if(matcher.test(key)) result.push(key);
      }
    } else {
      for(key in flowKeys()) result.push(key);
    }
    result.sort();
    break;
  case 'flows':
    if(path.length > 1) throw "not_found";
    name = flowSpecName(req.query['keys'],req.query['value'],req.query['filter']);
    if(!name) throw 'bad_request';
    result = activeFlows(agents,name,maxFlows,minValue,aggMode);
    break;
  default: throw 'not_found';
  } 
  return result;
});

