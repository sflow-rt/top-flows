$(function() { 
  var restPath =  '../scripts/top.js/';
  var shortcutsURL = restPath + 'shortcuts/json';
  var keysURL =  restPath + 'flowkeys/json';
  var topURL = restPath + 'flows/json';

  var SEP = '_SEP_';

  var defaults = {
    tab:0,
    hlp0:'show',
    hlp1:'hide',
    hlp2:'hide',
    keys:'',
    value:'',
    filter:'',
    topshow:50,
  };

  var state = {};
  $.extend(state,defaults);
		
  function nf(value,fix) {
    var suffixes = ["\u00B5", "m", "", "K", "M", "G", "T", "P", "E"];
    if (value === 0) return value;
    var i = 2;
    var divisor = 1;
    var factor = 1000;
    var absVal, scaled;
    absVal = Math.abs(value);
    while (i < suffixes.length) {
      if ((absVal / divisor) < factor) {
        break;
      }
      divisor *= factor;
      i++;
    }
    scaled = Math.round(absVal * factor / divisor) / factor;
    if(fix) scaled = scaled.toFixed(fix);
    return scaled + suffixes[i];
  };

  function createQuery(params) {
    var query, key, value;
    for(key in params) {
      value = params[key];
      if(value === defaults[key]) continue;
      if(query) query += '&';
      else query = '';
      query += encodeURIComponent(key)+'='+encodeURIComponent(value);
    }
    return query;
  }

  function getState(key, defVal) {
    return window.sessionStorage.getItem('top_flows_'+key) || state[key] || defVal;
  }

  function setState(key, val, showQuery) {
    state[key] = val;
    window.sessionStorage.setItem('top_flows_'+key, val);
    if(showQuery) {
      var query = createQuery(state);
      window.history.replaceState({},'',query ? '?' + query : './');
    }
  }

  function setQueryParams(query) {
    var vars = query.split('&');
    var params = {};
    for(var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if(pair.length === 2) setState(decodeURIComponent(pair[0]), decodeURIComponent(pair[1]),false);
    }
  }

  var search = window.location.search;
  if(search) setQueryParams(search.substring(1));

  $('#help-acc > div').each(function(idx) {
    $(this).accordion({
      heightStyle:'content',
      collapsible: true,
      active: getState('hlp'+idx, 'hide') === 'show' ? 0 : false,
      activate: function(event, ui) {
        var newIndex = $(this).accordion('option','active');
        setState('hlp'+idx, newIndex === 0 ? 'show' : 'hide', true);
      }
    });
  });
        
  $('#tabs').tabs({
    active: getState('tab', 0),
    activate: function(event, ui) {
      var newIndex = ui.newTab.index();
      setState('tab', newIndex, true);
      $.event.trigger({type:'updateChart'});
    },
    create: function(event,ui) {
      $.event.trigger({type:'updateChart'});
    }
  });

  $('#clone_button').button({icons:{primary:'ui-icon-newwin'},text:false}).click(function() {
     window.open(window.location);
  }); 

  var top_keys = getState('keys','');
  var top_value = getState('value','');
  var top_filter = getState('filter','');
	
  $('#keys')
    .val(top_keys)
    .bind( "keydown", function( event ) {
      if ( event.keyCode === $.ui.keyCode.TAB &&
        $( this ).autocomplete( "instance" ).menu.active ) {
	   event.preventDefault();
        }
      })
    .autocomplete({
      minLength: 0,
      source: function( request, response) {
	$.getJSON(keysURL, { search: request.term.split(/,\s*/).pop() }, response)
      },
      focus: function() {
        // prevent value inserted on focus
        return false;
      },
      select: function( event, ui ) {
        var terms = this.value.split(/,\s*/);
        // remove the current input
        terms.pop();
        // add the selected item
        terms.push( ui.item.value );
        // add placeholder to get the comma-and-space at the end
        terms.push( "" );
        this.value = terms.join( "," );
        return false;
      }
    })
    .focus(function() { $(this).autocomplete('search'); });

  $('#value')
    .val(top_value)
    .autocomplete({
       minLength:0,
       source:['bps', 'Bps', 'fps']
    })
    .focus(function() { $(this).autocomplete('search'); });
	
  $('#filter')
    .val(top_filter)
    .bind( "keydown", function( event ) {
      if ( event.keyCode === $.ui.keyCode.TAB &&
        $( this ).autocomplete( "instance" ).menu.active ) {
          event.preventDefault();
        }
    })
    .autocomplete({
      minLength: 0,
      source: function( request, response) {
        $.getJSON(keysURL, { search: request.term.split(/[&|(]\s*/).pop() }, response)
      },
      focus: function() {
        // prevent value inserted on focus
        return false;
      },
      select: function( event, ui ) {
        var val = this.value;
        var re = /[&|(]/g;
        var end = 0;
        while(re.test(val)) { end = re.lastIndex; }
        this.value = val.substring(0,end) + ui.item.value + "=";
        return false;
      }
    })
    .focus(function() { $(this).autocomplete('search'); });

  $('#cleardef').button({icons:{primary:'ui-icon-cancel'},text:false}).click(function() {
    $('#keys').val('');
    $('#value').val('');
    $('#filter').val('');
    top_keys = '';
    top_value = '';
    top_filter = '';
    setState('keys',top_keys);
    setState('value',top_value);
    setState('filter',top_filter,true);
    emptyTopFlows();
  });
  $('#submitdef').button({icons:{primary:'ui-icon-check'},text:false}).click(function() {
    top_keys = $.trim($('#keys').val()).replace(/(,$)/g, "");
    top_value = $.trim($('#value').val());
    top_filter = $.trim($('#filter').val());
    setState('keys',top_keys);
    setState('value',top_value);
    setState('filter',top_filter,true);
    emptyTopFlows();   
  });
  function valueToKey(val) {
    var key;
    switch(val) {
    case 'bps': 
      key = 'bytes'; 
      break;
    case 'Bps': 
      key = 'bytes'; 
      break;
    case 'fps': 
      key = 'frames'; 
      break;
    default: 
      key = val;
    }
    return key;
  }

  function valueToScale(val) {
    return 'bps' === val ? 8 : 1;
  }

  function valueToTitle(val) {
    var title;
    switch(val) {
    case 'bps': 
      title = 'bits per second'; 
      break;
    case 'bytes':
      case 'Bps': 
      title = 'bytes per second'; 
      break;
    case 'frames':
      case 'fps': 
      title  = 'frames per second'; 
      break;
    case 'requests':
      title = 'requests per second';
      break;
    default: 
      title = val;
    }
    return title;
  }

  function addFilter(key, value, filter) {
    var newFilter = filter;
    if(!newFilter) newFilter = "";
    if(newFilter.length > 0) newFilter += "&";
    newFilter += "'" + key + "'='" + value + "'";
    $('#filter').val(newFilter);	 
    top_filter = newFilter;
    setState('filter', top_filter, true);
    emptyTopFlows();
  }

  function topFlowsClick(e) {
    if(e.data && e.data.query && e.data.values) {
      var col = $(this).parent().children().index($(this));
      var row = $(this).parent().parent().children().index($(this).parent());
      var key = e.data.query.keys.match(/(\\.|[^,])+/g)[col];
      var val = e.data.values[row].key.split(SEP)[col];
      addFilter(key,val,e.data.query.filter);
    }
  }

  function escapeHTML(t) { return $('<div/>').text(t).html(); }

  function updateTopFlows(data,query,scale,title) {
    if($('#shortcutstable_wrapper').is(':visible')) return;

    var i, j, row, maxVal,val,barwidth,ncols = 1, table = '';
    table += '<table class="stripe">';
    table += '<thead>';
    if(query.keys && query.value) {
      var headers = query.keys.match(/(\\.|[^,])+/g);
      for(i = 0; i < headers.length; i++) {
        table += '<th>' + headers[i] + '</th>';
      }
      table += '<th>' + title + '</th>';
      ncols = headers.length + 1;
    }
    table += '</thead>';
    table += '<tbody>';
    if(data && data.length > 0) {
      maxVal = data[0].value;
      for(i = 0; i < data.length; i++) {
        if(!data[i].key) continue;
        table += '<tr class="' + (i % 2 === 0 ? 'even' : 'odd') + '">';
        row = data[i].key.split(SEP);
        for(j = 0; j < row.length; j++) {
          table += '<td class="flowkey">' + escapeHTML(row[j]) + '</td>';
        }
        val = data[i].value;
        barwidth = maxVal > 0 ? Math.round((val / maxVal) * 60) : 0;
        barwidth = barwidth > 0 ? barwidth + "%" : "1px";
        table += '<td class="flowvalue"><div class="bar" style="background-color:#3333FF; width: ' + barwidth + '"></div>' + nf(val * scale, 3) + '</td>';
        table += '</tr>';
      } 
    } else {
      table += '<tr class="even"><td colspan="' + ncols + '" class="alignc"><i>no data</i></td></tr>';
    }
    table += '</tbody>';
    table += '</table>';
    $('#flowtable').empty().append(table);
    $('#flowtable tbody .flowkey').click({query:query, values:data},topFlowsClick);
  }

  var $shortcutsTable;
  function initializeShortcutsTable() {
    $shortcutsTable = $('#shortcutstable').DataTable({
      ajax: {
        url: shortcutsURL,
        dataSrc: function(data) { 
          return data; 
        }
      },
      deferRenderer: true,
      columns:[
        {data:'category'},
        {data:'protocol'},
        {data:'description'}
      ],
      columnDefs: [ { targets: 2, orderable: false } ]
    })
    .page.len(getState('topshow'))
    .on('length', function(e,settings,len) {
      setState('topshow', len, true);
    })
    .on('xhr', function(e,settings,json) {
      var len = json.length || 0;
      $('#numshortcuts').val(len).removeClass(len ? 'error' : 'good').addClass(len ? 'good' : 'error');;
    })
    .on('click', 'tr', function(e) {
      var row = $shortcutsTable.row($(this));
      var shortcut = row.data();
      if(!shortcut) return;		
      top_keys = shortcut.keys || '';
      top_value = shortcut.value || '';
      top_filter = shortcut.filter || '';
      $('#keys').val(top_keys);
      $('#value').val(top_value);
      $('#filter').val(top_filter);
      setState('keys', top_keys, false);
      setState('value', top_value, false);
      setState('filter', top_filter, true);
      emptyTopFlows();
    });
  }

  var running_topflows;
  var timeout_topflows;
  function pollTopFlows() {
    running_topflows = true;
    var query = {keys:top_keys,value:valueToKey(top_value),filter:top_filter};
    var scale = valueToScale(top_value);
    var title = valueToTitle(top_value);
    $.ajax({
      url: topURL,
      data: query,
      success: function(data) {
        if(running_topflows) {
          updateTopFlows(data,query, scale, title);
          timeout_topflows = setTimeout(pollTopFlows, 2000);
        }
      },
      error: function(result,status,errorThrown) {
        if(running_topflows) timeout_topflows = setTimeout(pollTopFlows, 2000);
      },
      timeout: 60000
    });
  }

  function stopPollTopFlows() {
    running_topflows = false;
    if(timeout_topflows) clearTimeout(timeout_topflows);
  }

  function emptyTopFlows() {
    stopPollTopFlows();
    if(!top_keys || !top_value) {
      $('#shortcutstable_wrapper').show();
      $('#flowtable').empty();
      return;
    }
    $('#shortcutstable_wrapper').hide();
    var query = {keys:top_keys,value:valueToKey(top_value),filter:top_filter};
    var scale = valueToScale(top_value);
    var title = valueToTitle(top_value);
    updateTopFlows([],query,scale,title);
    pollTopFlows();
  }

  function refreshShortcuts() {
    $shortcutsTable.ajax.reload();
  } 

  function getShortcuts() {
    location.href = shortcutsURL;
  }
      
  function warningDialog(message) {
    $('<div>' + message + '</div>').dialog({dialogClass:'alert', modal:true, buttons:{'Close': function() { $(this).dialog('close'); }}})
  }

  $('#shortcutsrefresh').button({icons:{primary:'ui-icon-arrowrefresh-1-e'},text:false}).click(refreshShortcuts);
  $('#shortcutsget').button({icons:{primary:'ui-icon-search'},text:false}).click(getShortcuts);
  $('#shortcutsfile').hide().change(function(event) {
    var input = event.target;
    var reader = new FileReader();
    var $this = $(this);
    reader.onload = function(){
      var text = reader.result;
      $this.wrap('<form>').closest('form').get(0).reset();
      $this.unwrap();
      $.ajax({
        url:shortcutsURL,
        type: 'POST',
        contentType:'application/json',
        data:text,
        success:refreshShortcuts,
        error: function() { warningDialog('Badly formatted shortcuts'); }
      });
    };
    reader.readAsText(input.files[0]);
  });
  $('#shortcutsset').button({icons:{primary:'ui-icon-arrowstop-1-n'},text:false}).click(function() {$('#shortcutsfile').click();});

  initializeShortcutsTable();
  emptyTopFlows();
});
