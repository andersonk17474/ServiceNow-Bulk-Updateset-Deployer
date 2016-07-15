var $j = jQuery;


/**
  @global
  common functions that can be used by all classes in the app
*/
var common = {
    
    /**
      data storage for the common object available to application
      @property _data
    */
    '_data': {
        /**
          control browser console debug messages
          @property _DEBUG
        */
        'DEBUG': true,
        /**
          date format for service now date time fields
          @property SNOW_DATE_FORMAT
        */
        'SNOW_DATE_FORMAT' : 'YYYY-MM-DD HH:mm:ss',
        /**
          max number of worker status requests allowed and 
          delay between work completed query requests
          @property WORKER_MAX_QUERY  
          @property WORKER_WAIT_TIME
        */
        'WORKER_MAX_QUERY' : 500,
        'WORKER_WAIT_TIME' : 4000,
    },
    
    /**
      @method set
      @param {string} key
      @param {object} data
    */
    set : function(key, data){
        if (_.isString(key) && key.length){
            this._data[key] = data;
        }
    },
    
    /**
      @method get
      @param {string} key
      @return {object}
    */
    get : function (key){
        var result;
        if (_.isString(key) && key.length && _.keys(this._data).length){
            if (_.has(this._data, key)){
                result = this._data[key];
            } 
        }
        return result;    
    },
       
    /**
      output a mesage to the browser console
      @method debug
      @param {string|object} msg
    */
    debug : function(msg){
        if (this.get('DEBUG')){
            if (_.isString(msg)){
                common.log.debug(msg);
            }
            else{
                common.log.debug(JSON.stringify(msg));
            }
        }
    },
    
        
    /**
       send message to the UI log view
      @method clientLog
      @param {string} msg
	  @param {string|boolean} state
    */
    clientLog : function(msg, state){
		// send to browser console
        this.debug(msg);
        // send message to the user display script output
        PubSub.publish( 'LOG', {'message': msg, 'state': state});
    },
    
    /**
       extract the JSON object from the servicenow glideajax xml response
       @method extractJSON
       @param {object} response
       @returns {object}
    */
    extractJSON : function (response) {
        var result = {};
        try{
            var answer = response.responseXML.documentElement.getAttribute("answer");
            if (_.isString(answer)){
                //common.debug('decode xml answer: '+answer);
                result = JSON.parse(answer);
                if (!(result && _.isObject(result))) {
                    throw new Error("failed to parse JSON from XML formatted ajax response");
                }    
            }
            else{
                throw new Error('empty ajax response payload');
            }
        }
        catch(e){
            common.log.error('Error: '+e.message+' - extractJSON');
        }
        return result;
    },
    
    /**
      convert date in the format MM/DD/YYYY hh:mm A to the format YYYY-MM-DD HH:mm:ss
      @method toServiceNowDateFormat 
      @link momentjs.com
      @param {string} date
      example:  from format: 06/14/2016 12:00 AM
                to: 2015-06-03 13:04:22
    */
    toServiceNowDateFormat : function(date){
        var result = '';
        if (_.isString(date) && date.length){
            var new_date = moment(date, 'MM/DD/YYYY hh:mm A');
            if (new_date.isValid()){
                result = new_date.format(common.get('SNOW_DATE_FORMAT'));
            }
            else{
                common.log.error('error parsing moment.js date from source: '+new_date+' - toServiceNowDateFormat::'+this.type);
            }
        }
        return result;
    },
    
};

/**
  access to the loglevel library
  @property common.log  
*/
common.log = log.noConflict();


// extend all Backbone views with additional methods
_.extend(Backbone.View.prototype, {
    
    initStorage: function(){
        if (!this._options){
            this._options = { 'data' : {} };
        }
    },
    
    /**
      set the local data object storage for a key->value pair 
      @method _set
      @param {string} key
      @param {object} data
    */
    _set : function(key, data){
        this.initStorage();
        if (key && _.isString(key)) {
            this._options.data[key] = data;
        }
    },
    
    /**
      get the local data object storage for a key-> value pair 
      @method _get
      @param {string} key
      @param {object} data
    */
    _get : function(key){
        var result;
        if (this._options && _.isString(key) && _.keys(this._options.data).length){
            if (_.has(this._options.data, key)){
                result = this._options.data[key];
            } 
        }
        return result;
    },
    
    /**
      retrieve underscore template from server template table
      @method getTemplate
      @param {string} name
    */
    getTemplate : function(name){
        var context = this;
        if (_.isString(name) && name.length){
            $j.ajax({
                'url': 'get-template.do',
                'data' : {'name': name},
                'success' : function(data, status, xhr){
                    //console.log(name+ ' template: '+data)
                    if (!context.templates){
                        context.templates = {};
                    }
                    context.templates[name] = data;
                },
                
            });
        }
    },
    

});



var Application = Backbone.View.extend({

    events: {
        'click .right-panel .nav li' : 'navClickHandler',
        'click .config-params .glyphicon-info-sign' : 'helpIconClickHandler',
    },

    views : {},

    initialize: function (options) {
        // enable all log messages for the logging library
        common.log.setLevel('trace', false);
        
        common.debug('start app');
       

        
        var context = this;
        
                
        this.views.run_params_form = new RunParamsForm({'el': this.$el.find('.run-parameters')});
        this.views.script_output = new ScriptOutput({'el': this.$el.find('.script-output-container .panel-body')});
        this.views.retreived_us = new UpdateSetsView({'el': this.$el.find('.retrieved-update-sets .panel-body'), 'mode': 'retrieved'});
        this.views.previewed_us = new UpdateSetsView({'el': this.$el.find('.previewed-update-sets .panel-body'), 'mode': 'previewed'});
        this.views.committed_us = new UpdateSetsView({'el': this.$el.find('.committed-update-sets .panel-body'), 'mode': 'committed'});
        this.views.preview_controls = new PreviewControlsView({'el': this.$el.find('.previewed-update-sets .panel-heading')});
        
        // pubsub listeners
        PubSub.subscribe( 'NAV.SELECT', function(msg, data){
            if (_.keys(data).length && _.has(data, 'tab_name') && _.isString(data.tab_name)){
                var target = {};
                context.$el.find('.right-panel .nav li').each(function(){
                    var attr = $j(this).attr('data-panel-name');
                    if (_.isString(attr)){
                        if (attr.toLowerCase().indexOf(data.tab_name.toLowerCase()) >=0 ){
                            $j(this).trigger('click');
                        }
                    }
                });
            }
        });
        
    },    

    render : function(){
        this.views.run_params_form.render();
     
        
    },
    
    
    /**
      toggle the display of the help text under the help icon  
      @method helpIconClickHandler
    */
    helpIconClickHandler : function (e){
        var $el = $j(e.target);
        var $help = $el.closest('.row').find('.alert');
        if ($help.length){
            if ($help.hasClass('hidden')){
                $help.removeClass('hidden');
            }
            else{
                $help.addClass('hidden');
            }
        }
    },
    
    
    /**
      @method navClickHandler
    */
    navClickHandler : function(e){
        common.debug('nav click');
        
        var $target = $j(e.target);
        $target.closest('ul').find('li').each(function(){
            $j(this).removeClass('active');
        });
        var attr = '';
        if ($target.prop('tagName').toLowerCase() === 'li'){
            attr = $target.attr('data-panel-name');
            $target.addClass('active');
        }
        else{
            $target.closest('li').addClass('active');
            attr = $target.closest('li').attr('data-panel-name');
        }
        
        $target.closest('.right-panel').find('.output-container').each(function(){
            $j(this).addClass('hidden');
        });
        
        $target
            .closest('.right-panel')
            .find('.output-container.'+attr)
            .removeClass('hidden');
        
    },
    

    
    
    
    type: 'Application',
});

var RunParamsForm = Backbone.View.extend({
	
	//.config-params
    
    type: 'RunParamsForm',
    events: {
        'click .start-deploy button': 'startDeploy',
        'keydown .date input': 'dateKeydownHandler'

    },
    
    initialize: function (options) {
        var context = this;
        this.getUpdateSources(); 
        
        console.log(options)
        if (_.has(options, 'common')){
            this.common = options.common;
        }
        
        this.$datepicker_release = null;
        this.$datepicker_created = null;
        
        // pubsub listeners
        PubSub.subscribe( 'TOGGLE_START_BUTTON', function(msg, data){
            var $btn = context.$el.find('.start-deploy button');
            if ($btn.length){
                $btn.prop('disabled', (!$btn.prop('disabled')));
            }
        });
        
    },
    
	render : function(){
		common.debug(this.$el)
        var context = this;
        
        var $remote_host = this.$el.find('.remote-host select');
        var $release_date = this.$el.find('#datetimepicker-release');
        var $created_after_date = this.$el.find('#datetimepicker-createdafter');
        
        this.$datepicker_release = $release_date.datetimepicker({'format': 'L'});
            
        this.$datepicker_created = $created_after_date.datetimepicker();
        
        
        $remote_host.on('change', function(e){
            var value = $remote_host.val();
            $remote_host.find('option').each(function(){
                if ($j(this).val() === value){
                    $j(this).attr('selected', 'selected');
                }
                else{
                    $j(this).removeAttr('selected');
                }
            });
            

        });
        
        
        $release_date.find('input').on('click',  function(e){
            $release_date.data("DateTimePicker").toggle();
        });
        
		this.$datepicker_release.on('dp.change', function(e){
            var value = $release_date.find('input').val().trim();
            if (!$release_date.data('release-date-prev')){
                $release_date.data('release-date-prev', value)
            }
            else{
                if (value !== $release_date.data('release-date-prev')){
                    $release_date.data("DateTimePicker").toggle();
                    $release_date.data('release-date-prev', value);
                }
            }
            
        });
        
        
        $created_after_date.find('input').on('click',  function(e){
            $created_after_date.data("DateTimePicker").toggle();
        });
        
        this.$datepicker_created.on('dp.change', function(e){
            var value = $created_after_date.find('input').val().trim();
            if (!$created_after_date.data('created-date-prev')){
                $created_after_date.data('created-date-prev', value)
            }
            else{
                if (value !== $created_after_date.data('created-date-prev')){
                    $created_after_date.data("DateTimePicker").toggle();
                    $created_after_date.data('created-date-prev', value);
                }
            }
        });
        
	},
    
    getUpdateSources: function(){
        var context = this;
        var gr =  new GlideRecord('sys_update_set_source');
        gr.query( function recResponse(rec) {
            while (rec.next()) { 
                common.debug('recieved remote instance record: '+rec.name+','+rec.sys_id);
                context.$el.find('.remote-host select').append(
                   '<option value = "'+rec.sys_id+'">'+rec.name+'</option>'
                );
            } 
        });
         
       
        
    },
    
    /**
      clear the calendar data when the user starts deleting the input text
      @method dateKeydownHandler
    */
    dateKeydownHandler : function(e){
        var keycode = e.keyCode || e.which;
        // if user deleted the date text
        if ((keycode === 8 || keycode === 46) ){
            $j(e.target).closest('.date').data("DateTimePicker").clear();
        }
        
    },
    
    
    /**
      read form inputs and then call pubsub message to begin the updateset deployment process
      @method startDeploy
    */
    startDeploy : function(e){
        var context = this;

        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response));
            var data = common.extractJSON(response);
            if (_.keys(data).length) {
                if (_.has(data, 'error') && _.isString(data.error) && data.error.length){
                    common.clientLog('Error: unable to get system datetime: '+ data.error, 'error');
                }
                else if ( _.has(data, 'date') && _.has(data, 'time')) {
                    common.debug(data.datetime);
                    common.set('START_TIME', data);
                    PubSub.publish('FETCH_UPDATE_SETS', {'search_params': common.get('search_params')});
                    PubSub.publish('NAV.SELECT', {'tab_name': 'retrieved'});
                }
            }
        
        };

        if (this.validate()){
            $j(e.target).prop('disabled', true);
            common.set('search_params', this.getFormData());
            PubSub.publish( 'RESET', {'source' : this.type } );
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','getTimeStamp');
            ga.getXML(callback);
        }
        
    },
    /**
      TODO:  fix date format for date fields
      target:  2015-06-03 13:04:22
      current: 06/09/2016 12:00 AM
      
    */
    getFormData : function(){
        var context = this;
        var result = {};
        var cntr = 0;
        this.$el.find('.form-group input, .form-group select').each(function(){
            var value = $j(this).val().trim();
            var attr = $j(this).attr('name') || 'for_variable_'+cntr;
            if (context.isDateField(this) && value.length){
                var converted_date = common.toServiceNowDateFormat(value);
                if(converted_date.length){
                    value = converted_date;
                }
                else{
                    value = '';
                }
            }
            else if (context.isCheckBox(this)){
                value = 'off';
                if ($j(this).is(':checked')){
                    value = 'on';
                }
            }
            cntr++;
            result[attr] = value;
        });
        return result;
    },
    
    isCheckBox : function(el){
        var result = false;
        var $el = $j(el);
        if ($el && $el.length){
            var tag_name =  $el.prop('tagName');
            var type_attr = $el.attr('type');
            if ( _.isString(tag_name) && tag_name.toLowerCase() === 'input'){
                if (_.isString(type_attr) && type_attr.toLowerCase().indexOf('checkbox') >= 0){
                    result = true;
                }
            }
        }
        return result;
    },
    
    isDateField : function(el){
        var result = false;
        var $el = $j(el);
        if ($el && $el.length){
            var tag_name =  $el.prop('tagName');
            var name_attr = $el.attr('name');
            var type_attr = $el.attr('type');
            if ( _.isString(tag_name) && tag_name.toLowerCase() === 'input'){
                if (_.isString(type_attr) && type_attr.toLowerCase().indexOf('date') >= 0){
                    result = true;
                }
                else if (_.isString(name_attr) && name_attr.toLowerCase().indexOf('date') >= 0){
                    result = true;
                }
                else if ($el.hasClass('calendar-picker')){
                    result = true;
                }
                else if ($el.closest('.date' ).length > 0){
                    result = true;
                }
            }
        }
        return result;
    },
    
    validate : function(){
        
        var result = true, context = this;
        var err_cntr = 0, elem_arr_bad_date = [];
        var date_err = 0;
        //var isDateField = function(el){
            //return ($j(el).closest('.date' ).length > 0 );
        //};
        
        var markError = function(el){
            $j(el).closest('.form-group').addClass('has-error').one('focusin', function(){
                $j(this).removeClass('has-error');
            });
        };
        
        var markDateError = function(el){
            $j(el).closest('.form-group').addClass('has-error');
            // clear error state listener to all date fields - only 1 required
            // each input has a listener that will clear all date error fields
            context.$el.find('.input-group.date').each(function(){
                $j(this).one('focusin', '.form-control', function(){
                    context.$el.find('.input-group.date').each(function(){
                        $j(this).parent().removeClass('has-error');
                    });
                });    
            });    
            
        };
        
        this.$el.find('.form-group input:not(".name-filter"), .form-group select').each(function(){
            var value = $j(this).val().trim();
            
            common.debug('validation value test: '+$j(this).val());
            
            if ( context.isDateField(this)){
                //console.log('date field')
                if (value.length === 0){
                    elem_arr_bad_date.push(this);
                    err_cntr++;
                    date_err ++;
                }
                else {
                    // validate format
                    var day = moment(value, 'MM/DD/YYYY hh:mm A');
                    //console.log('date is: '+day.format('YYYY-MM-DD hh:mm:ss') )
                    if (!day.isValid()){
                        elem_arr_bad_date.push(this);
                        err_cntr++;
                        date_err ++;
                    }
                }
               
            } 
            else if ((!context.isDateField(this)) && value.length === 0 ){
                markError(this);
                err_cntr++;
            }
            
        });
        
        
        if (err_cntr > 0){
            if (elem_arr_bad_date.length != 1){
                $j.each(elem_arr_bad_date, function(){
                    markDateError (this);
                });
            }
            
            if(err_cntr === 1 && date_err == 1 ){
                // if only one date field is valid, validation passes
                result = true;
            }
            else{
                result = false;
            }
        }
        
        return result;
        
    },
    
  

});

var ScriptCollection = Backbone.Collection.extend({
    
    initialize: function (options) {
        
       
    },  

    /**
      query the syslog table for update set deployer log entries after target date
      @method getServerLogEntries
      @param {string} created_after_date
    */
    getServerLogEntries : function(created_after_date){
        var context = this;
        if (_.isString(created_after_date) && created_after_date.length){
            var date = moment(created_after_date, common.get('SNOW_DATE_FORMAT'));
            if (date.isValid()){
                var callback = function(response){
                    //console.log('recieved: '+JSON.stringify(response))
                    var data = common.extractJSON(response);
                    context.addRecords(data.logs);
                    PubSub.publish( 'RENDER', {'target': 'log'});
                };
                console.log('Get Logs after :'+created_after_date);
                
                var data = {
                    'created_after_date' : created_after_date,
                };

                var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
                ga.addParam('sysparm_name','getLogOutput');
                ga.addParam('sysparm_data',JSON.stringify(data));
                ga.getXML(callback);
            }
        }    
    },    
    
    /**
      add 1 or more entries to the script output area of the app
      @method addRecords
      @param {array|string} logs_msgs
	  @param {string} state error, warn, info
    */
    addRecords : function(log_msgs, state){
        
		if (_.isArray(log_msgs)){
            _.each(log_msgs, function (v,k){
                var model = new Backbone.Model(v);
				model.set('state', 'info');
                this.push(model);
            }, this);
        }
        else if (_.isString(log_msgs) && log_msgs.length){
            // service now DB is pacific time, we are EST time, substract 3 hr
            var dttm = new moment().subtract(3, 'hours').format(common.get('SNOW_DATE_FORMAT'));
            var model = new Backbone.Model({'created' : dttm, 'message' : log_msgs, 'state' : (state||'info')});
            this.push(model);
        }
        
    },
    
});


var ScriptOutput = Backbone.View.extend({
  
    initialize: function (options) {
        var context = this;

        this.collection = new ScriptCollection(options);
        
        // pubsub listeners
        PubSub.subscribe( 'RESET', function(msg, data){
            context.reset();
        });
        
        // pubsub listeners
        PubSub.subscribe( 'RENDER', function(msg, data){
            if (_.keys(data).length && _.has(data, 'target') && data.target === 'log'){
                context.render();
            }    
        });
        
        // pubsub listeners
        PubSub.subscribe( 'LOG', function(msg, data){
            if (_.keys(data).length && _.has(data, 'message')){
                var state = 'info';
				if (_.has(data, 'state') && _.isString(data.state) && _.indexOf( ['warn', 'error'], data.state.toLowerCase()) >= 0){
					state = data.state.toLowerCase();
				}
				if (_.isBoolean(data.state) && data.state){
					state = 'error';
				}
				
				context.collection.addRecords(data.message, state);
                context.render();
            }
        });
        
        
    },
    
    reset: function(){
        this.collection.reset(null);
        this.render();       
    },
    
    /**
      writeToLogArea
      @method render
    */
    render : function(){
        //console.log(JSON.stringify(this.collection.toJSON()))
        this.$el.empty();
        // newest entry should be on top
        var models = _.clone(this.collection.models);
        models.reverse();
        _.each(models, function(v,k){
            var $frag = $j('<div>').addClass('log-entry row');
            $frag.append('<div class="col-xs-4 date">'+v.get('created')+'</div><div class="message '+v.get('state')+' col-xs-8">'+v.get('message')+'</div>')
            this.$el.append($frag);
        }, this);
    },
    
    
});


var UpdateSetCollection = Backbone.Collection.extend({
    /**
      add raw array of  objects to the collection, creating a model for each object
      @method addRecords
      @param {array} data 
    */
    addRecords : function(data){
        //console.log('add records: '+JSON.stringify(data))
        if (_.isArray(data)){
            _.each(data, function (v,k){
                var model = new Backbone.Model(v);
                this.push(model);
            }, this);
        }
    },
    
    /**
      call the server to check if all the progress workers are completed
      @method workersCompleted
      @param {array} worker_ids
      @param {string} transaction_id
      @param {function} function to call when all workers are detected as completed
      @param {number} counter track number of server requests this function has made
    */
    workersCompleted : function(worker_ids, transaction_id, callback, counter){
        var context = this;
        if (!_.isNumber(counter)){
            counter = 0;
        }
        else{
            counter = counter +1;
        }
        
        /**
          ajax response handler for the progress worker completed check
          @method worker_check_callback
          @param {string} response
        */
        var worker_check_callback = function(response){
            common.debug('recieved: '+JSON.stringify(response));
            var data = common.extractJSON(response);
            if (data && _.has(data, 'answer') && _.isBoolean(data.answer)){
                if (data.answer && _.isFunction(callback)){
                    common.clientLog('progress workers completed');
                    callback(data);
                }
                else if (counter < common.get('WORKER_MAX_QUERY')){
                    var wait_ms = common.get('WORKER_WAIT_TIME')
                    setTimeout(function(){
                        common.clientLog('check progress worker - attempt: '+(counter+1)+', wait '+(wait_ms/1000).toFixed(1)+'s');
                        context.workersCompleted(worker_ids, transaction_id, callback, counter); 
                    }, wait_ms);
                }
            }

        };
        
        if (_.isArray(worker_ids) && worker_ids.length && _.isString(transaction_id) && transaction_id.length){
            
            var data = {
                'workers': worker_ids,
                'transaction_id': transaction_id,
                'start_time': common.get('START_TIME').datetime,
            };
            common.debug('preview workers check params: '+JSON.stringify(data));
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','areAllWorkersCompleted');
            ga.addParam('sysparm_data',JSON.stringify(data));
            ga.getXML(worker_check_callback);
        }
    },
    
    /**
      noop at the parent collection level - define in the children
      @method filter
      @returns {array} models
    */    
    filter : function(){
        return this.models;
    },
    
});

var RetreivedUSCollection = UpdateSetCollection.extend({
    'type': 'RetreivedUSCollection',
    /**
      @method initialize
    */
    initialize : function(){
        var context = this;
        // pubsub listeners
        PubSub.subscribe( 'FETCH_UPDATE_SETS', function(msg, data){
            var delete_updatesets = objectPath.get(data, 'search_params.delete-matching');
            if (delete_updatesets  === 'on') {
                common.debug('DELETE BEFORE FETCH');
                // first delete the retrieved update stes that match, then call fetch
                context.deleteUpdateSets();
            }
            else{
                common.debug('FETCH REMOTE UPDATE SETS');
                context.gaFetch();
            }
        });
        
    },
    
    /**
      @method deleteUpdateSets

    */
    deleteUpdateSets : function(search_params){
        var context = this;
        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response))
            var data = common.extractJSON(response);
            if (data && _.has(data, 'worker_id')){
                common.clientLog('progress worker started with id: '+data.worker_id);
                if (data.worker_id.length){
                    common.clientLog(data.targets.length+' records targeted for delete');
                    context.workerCompleted('delete', data.worker_id);
                }
                else{
                    // no progress workers started, - no records found to be deleted
                    // start the update set retrieve proccess
                    common.clientLog('No matching records found to delete', 'warn');
                    context.gaFetch();
                }
            }
            else{
                common.log.error('Missing attribute from response data object - "worker_id"');
            }

        };
        common.clientLog('Delete: '+this.type+', params: '+JSON.stringify(common.get('search_params')));
         PubSub.publish( 'PROCESSING-MESSAGE', {'target':'retrieved', 'message': 'Deleting Matching Remote Update Sets...'});
        var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
        ga.addParam('sysparm_name','deleteRetrievedUpdateSets');
        ga.addParam('sysparm_data',JSON.stringify(common.get('search_params')));
        ga.getXML(callback);
        
    },
    
    
    
    /**
      use glideAjax to fetch update sets from server
      @method gaFetch
    */
    gaFetch : function(){
        var context = this;
        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response))
            var data = common.extractJSON(response);
            if (data && _.has(data, 'worker_id') && data.worker_id.length){
                common.clientLog('progress worker started with id: '+data.worker_id);
                context.workerCompleted('retrieve', data.worker_id);
            }
            else{
                common.clientLog('Invalid Ajax response: missing attribute from response data object - "worker_id"', 'error');
            }

        };
        common.clientLog('start: '+this.type+', params: '+JSON.stringify(common.get('search_params')));
        PubSub.publish( 'PROCESSING-MESSAGE', {'target':'retrieved', 'message': 'Retrieving Remote Update Sets...'});
        var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
        ga.addParam('sysparm_name','retrieveRemoteUpdateSets');
        ga.addParam('sysparm_data',JSON.stringify(common.get('search_params')));
        ga.getXML(callback);
    },
    /**
      recursive call to 
      @method workerCompleted
      @param {string} mode
      @param {string} worker_id
      @param {number} counter
    */
    workerCompleted : function(mode, worker_id, counter){
        var context = this;
        if (!_.isNumber(counter)){
            counter = 0;
        }
        else{
            counter = counter + 1;
        }
        if (_.isString(worker_id) && worker_id.length){
            var callback = function(response){
                var data = common.extractJSON(response);
                if (data && _.has(data, 'completed') && _.has(data, 'worker_id')){
                    if (data.completed){
                        common.clientLog('progress worker completed');
                        if (mode === 'retrieve'){
                            context.getRetrievedUpdateSets();
                        }
                        else if(mode === 'delete'){
                            // delete completed, start update set fetch process
                            context.gaFetch();
                        }
                        else{
                            common.log.error('invalid parameter "mode", expected values: "retrieve" or "delete" - workerCompleted::'+context.type);
                        }
                       
                    }
                    else if (counter < common.get('WORKER_MAX_QUERY') ){
                        var wait_ms = common.get('WORKER_WAIT_TIME');
                        setTimeout(function(){
                            common.clientLog('check progress worker - attempt: '+(counter+1)+', wait '+(wait_ms/1000).toFixed(1)+'s');
                            context.workerCompleted(mode, worker_id,  counter);
                        }, wait_ms);
                    }
                    else{
                        common.log.error('Max progress worker query attempts reached, aborting. -workerManager::'+context.type);
                    }
                }
                else{
                    common.log.error('Error: invalid response from server - workerManager::'+context.type);
                }
            };
        
            var data = {
                'worker_id' : worker_id,
            };

            
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','isProgressWorkerCompleted');
            ga.addParam('sysparm_data',JSON.stringify(data));
            ga.getXML(callback);
            
        }
    },
    
    /**
      query db for all the retrieved update sets that match form search parameters
      @method getRetrievedUpdateSets
    */
    getRetrievedUpdateSets : function( ){
        var context = this;
        common.debug(common.get('search_params'));
        var callback = function(response){
            var data = common.extractJSON(response);
            common.debug('recieved: '+JSON.stringify(data))
            if (data && _.has(data, 'update_sets')){
                context.reset();
                context.addRecords(data.update_sets);
                common.set('remote_update_set_sysids', _.pluck(data.update_sets, 'sys_id'));
                PubSub.publish( 'RENDER', {'mode': 'retrieved', 'target' : 'update-sets'});
                PubSub.publish('UPDATE-SET-COUNT', {'count' : context.length, 'target' : 'retrieved'});
                // fire off the update set preview workers 
                PubSub.publish('PREVIEW_UPDATE_SETS');
                
            }
        }
        PubSub.publish( 'PROCESSING-MESSAGE', {'target':'retrieved', 'message': 'Building List of Matching Update Sets...'});
        var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
        ga.addParam('sysparm_name','getRetrievedUpdateSets');
        ga.addParam('sysparm_data',JSON.stringify(common.get('search_params')));
        ga.getXML(callback);
    },
    
    
});


var PreviewedUSCollection = UpdateSetCollection.extend({
    'type': 'PreviewedUSCollection',
    /**
      @method initialize
    */
    initialize : function(){
        var context = this;
        // pubsub listeners
        PubSub.subscribe( 'PREVIEW_UPDATE_SETS', function(msg, data){
            context.gaFetch();
        });
        
    },
    
    /**
      use glideAjax to fetch previeved update sets from server
      @method gaFetch
    */
    gaFetch : function(){
    var context = this;
        
        /**
          for the progress worker check, need to pass in a callback function
          to execute when all workers are completed
          @method workers_completed_callback
        */
        var workers_completed_callback = function(){
            //common.clientLog('preview progress workers completed');
            common.debug('get preview report');
            context.getPreviewReport(common.get('remote_update_set_sysids'));
        };
        
        /**
          ajax response handler for the request to begin update set preview process
          @method callback
          @param {string} response
        */
        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response));
            var data = common.extractJSON(response);
            if (data && _.has(data, 'workers') && _.has(data, 'transaction_id')){
                context.workersCompleted(data.workers, data.transaction_id, workers_completed_callback);
            }

        };
        
        // extract the timestamp established when user submitted form and add to parameters object
        var params_obj = {'start_time': common.get('START_TIME').datetime};
        // add the user form search parameters to the params object
        _.extend(params_obj, common.get('search_params'));
        PubSub.publish( 'PROCESSING-MESSAGE', {'target':'previewed', 'message': 'Previewing Update Sets...'});
        common.clientLog('start: '+this.type+', params: '+JSON.stringify(params_obj));
        var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
        ga.addParam('sysparm_name','previewRetrievedUpdateSets');
        ga.addParam('sysparm_data',JSON.stringify(params_obj));
        ga.getXML(callback);

    },
      
    
    
    /**
      for an array of remote update sets, get the associated preview report
      @method getPreviewReport
      @param {array} remote_update_set_sys_ids
    */
    getPreviewReport : function(remote_update_set_sys_ids ){
        var context = this;
        common.debug('reports for: '+JSON.stringify(remote_update_set_sys_ids));
        
        /**
          ajax response handler to getPreviewReport server call
          @method callback
        */
        var callback = function(response){
            var data = common.extractJSON(response);
            common.debug('recieved: '+JSON.stringify(data));
            context.reset();
            context.addRecords(data);
            PubSub.publish( 'RENDER', {'mode': 'previewed', 'target' : 'update-sets'});
            // set the # of update sets previewed in the list header
            PubSub.publish('UPDATE-SET-COUNT', {'count' : context.length, 'target' : 'previewed'});
            // set the previewed tab to visible  
            PubSub.publish( 'NAV.SELECT', {'tab_name': 'previewed'});
            
            // begin the commit process if the search parameter is checked to auto-commit
            var search_params = common.get('search_params');
            if (_.has(search_params, 'commit-clean') && search_params['commit-clean'] === 'on'){
                // wait a moment before starting the commit process
                setTimeout(function(){
                    PubSub.publish( 'COMMIT_UPDATE_SETS', {'models': context.filter({'clean-dirty-results':'clean'})});
                }, 2000);
                
            }
            else{
                // when not doing commit, enable start button in form after this step 
                PubSub.publish( 'TOGGLE_START_BUTTON');
            }
            
        };
        
        
        if (_.isArray(remote_update_set_sys_ids) && remote_update_set_sys_ids.length){
            var param_obj = {
                'start_time': common.get('START_TIME').datetime,
                'sys_ids': remote_update_set_sys_ids,
            };
            PubSub.publish( 'PROCESSING-MESSAGE', {'target':'previewed', 'message': 'Getting Preview Report...'});
            common.debug(param_obj);
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','getPreviewReport');
            ga.addParam('sysparm_data',JSON.stringify(param_obj));
            ga.getXML(callback);
        }
    },
    
    /**
      return a copy of the collection filtered to a subset of the data
      @method filter
      @parm {object} filters
      @returns {array} array of models
    */
    filter : function(filters){
        var models = this.models;
        common.debug('FILTER RESULTS '+JSON.stringify(filters));
        if (_.keys(filters).length){
            if (_.has(filters, 'text-filter') && filters['text-filter'].length){
                var match_text = filters['text-filter'].toLowerCase();
                models = _.filter(models, function(model){
                    //common.debug('TEXT test: '+model.get('update_set_name'))
                    return (model.get('update_set_name').toLowerCase().indexOf(match_text) >= 0);
                }, this); 
                
            }
            if (_.has(filters, 'clean-dirty-results')){
                if ( filters['clean-dirty-results'] === 'clean'){
                    // return only update sets that have no collisions
                    models = _.filter(models, function(model){
                        //common.debug('CLEAN test: '+model.get('dirty_updates'))                   
                        return (model.get('dirty_updates') === 0);
                    }, this); 
                }
                else if ( filters['clean-dirty-results'] === 'dirty'){
                    // return only update sets that have no collisions
                    models = _.filter(models, function(model){
                        //common.debug('DIRTY test: '+model.get('dirty_updates'))                   
                        return (model.get('dirty_updates') > 0);
                    }, this); 
                }
            }
        }
        
        return models;
    },
});    



var CommittedUSCollection = UpdateSetCollection.extend({
    'type': 'CommittedUSCollection',
    /**
      @method initialize
    */
    initialize : function(){
        var context = this;
        // pubsub listeners
        PubSub.subscribe( 'COMMIT_UPDATE_SETS', function(msg, data){
            common.debug('commit data: '+JSON.stringify(data))
            if (_.keys(data) && _.has(data, 'models') && _.isArray(data.models)){
                if (data.models.length){
                context.reset(data.models);
                common.debug('DO COMMIT: '+JSON.stringify(context.pluck('update_set_sys_id')))
                context.gaFetch();
                }
                else{
                    common.clientLog('No clean update sets found for commit', 'warn');
                    PubSub.publish( 'TOGGLE_START_BUTTON');
                }
            }
        });
        
    },
    
    /**
      use glideAjax to fetch begin process to commit update sets from server
      @method gaFetch
    */
    gaFetch : function(){
    var context = this;
        
        /**
          success callback for the progress worker check rfecursive fx
          @method workers_completed_callback
        */
        var workers_completed_callback = function(){
            common.clientLog('Commit progress workers completed');
            
            // get the commit log for each update set
            context.getCommitLogs();

        };
        
        /**
          ajax response handler to start the commit process
          @method callback
        */
        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response));
            var data = common.extractJSON(response);
            if (data && _.has(data, 'committed') && _.isArray(data.committed)){
                var progress_workers = [];
                var transaction_id = '';
                _.each(context.models, function(model, index){
                    var committed_obj = _.findWhere(data.committed, {'remote_sys_id': model.get('update_set_sys_id')});
                    if (_.keys(committed_obj).length && _.has(committed_obj, 'worker_id')){
                        model.set('committed', true);
                        model.set('local_sys_id', committed_obj.local_sys_id);
                        progress_workers.push(committed_obj.worker_id);
                        if (transaction_id.length === 0){
                            transaction_id = committed_obj.transaction_id;
                        }
                    }
                    else{
                        model.set('committed', false);
                        common.clientLog('NOT Committed: '+model.get('update_set_name'), 'warn');
                    }

                }, context);
                
                common.debug('updated collection after commit: '+JSON.stringify(context.toJSON()));
                
                if (progress_workers.length){
                    // wait for the commit workers to complete, then fetch the commit logs
                    context.workersCompleted(progress_workers, transaction_id, workers_completed_callback);
                }
                else{
                    common.clientLog('No update set commit progress workers returned', 'warn');
                    PubSub.publish( 'TOGGLE_START_BUTTON');
                }
            }
         

        };
        // extract the timestamp established when user submitted form and add to parameters object
        var params_obj = {
            'update_set_sys_ids' : this.pluck('update_set_sys_id'),
        };
        if (params_obj.update_set_sys_ids.length){
            // add the user form search parameters to the params object
            _.extend(params_obj, common.get('search_params'));
            
            PubSub.publish( 'PROCESSING-MESSAGE', {'target':'Committed', 'message': 'Committing Clean Update Sets...'});
            common.clientLog('start: '+this.type+', params: '+JSON.stringify(params_obj));
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','commitPreviewedUpdateSets');
            ga.addParam('sysparm_data',JSON.stringify(params_obj));
            ga.getXML(callback);
        }
    },
    
    /**
      read the commit loads for each committed local update set
      @method getCommitLogs
      @param {array} local update sets
    */
    getCommitLogs : function(){
        var context = this;
        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response));
            var data = common.extractJSON(response);
            if (data && _.keys(data).length){
                // add logs to the collection models
                _.each(context.models, function(model, index){
                    if (model.get('committed')){
                        var logs = data[model.get('local_sys_id')]; 
                        if (_.isArray(logs) && logs.length){
                            model.set('commit_logs', logs);  
                        }
                    }
                });
                
                common.debug('updated collection after logs fetch: '+JSON.stringify(context.toJSON()));
                
                PubSub.publish( 'RENDER', {'mode': 'committed', 'target' : 'update-sets'});
                PubSub.publish( 'TOGGLE_START_BUTTON');
            }
        };
        
        
        // get update sets local sys ids for all committed retrieved update sets
        var lus_sysids = _.map(this.where({'committed': true}), function(model, key){
            return model.get('local_sys_id');
        }, this);

        if (_.isArray(lus_sysids) && lus_sysids.length){
            var params_obj = {
                'local_updateset_sysids' : lus_sysids,
            };
            PubSub.publish( 'PROCESSING-MESSAGE', {'target':'Committed', 'message': 'Getting Commit Logs...'});
            common.clientLog('get commit logs: '+this.type+', params: '+JSON.stringify(params_obj));
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','getCommitLogs');
            ga.addParam('sysparm_data',JSON.stringify(params_obj));
            ga.getXML(callback);
            
        }
    },
    

    
});   

 

var UpdateSetsView = Backbone.View.extend({
	
	initialize: function (options) {
        var context = this;
        
        this.list_template_postfix = '_update_set_list';
        
        
        if (_.has(options, 'mode') && _.isString(options.mode) && _.indexOf(options.mode.toLowerCase(), ['retrieved','previewed','committed'])){
            this.mode = options.mode.toLowerCase();
            this.getTemplate(this.mode+this.list_template_postfix);
            if (this.mode === 'retrieved'){
                this.collection = new RetreivedUSCollection();
            }
            else if (this.mode === 'previewed'){
                this.collection = new PreviewedUSCollection();

            }
            else if (this.mode === 'committed'){
               this.collection = new CommittedUSCollection();
            }
            else{
                // fallback - should be unnecessary
                this.collection = new UpdateSetCollection();
            }
        }
        else{
            throw new Error('Missing parameter - "mode"');
        }
        
        // pubsub listeners
        PubSub.subscribe( 'RESET', function(msg, data){
            context.reset(true);
        });
        
        // add a status message to the update set list area 
        PubSub.subscribe( 'PROCESSING-MESSAGE', function(msg, data){
            if (_.keys(data).length && _.has(data, 'target') && data.target === context.mode){
                if (_.has(data, 'message') && _.isString(data.message)){
                    $target = context.$el.closest('.panel').find('.panel-body');
                    if ($target.length){
                        if ($target.find('.status-message').length){
                            $target.find('.status-message').text(data.message);
                        }
                        else{
                            $target.prepend('<div class="status-message">'+data.message+'</div>');
                        }    
                    }
                }
            }     
        });
        
        
        // update the update set list header to include the number of update sets displayed
        PubSub.subscribe('UPDATE-SET-COUNT', function(msg, data){
            if (_.keys(data).length && _.has(data, 'target') && data.target === context.mode){
                if (_.has(data, 'count') && _.isNumber(data.count)){
                    var $target = context.$el.closest('.panel').find('.panel-title .count');
                    if ($target.length){
                        $target.html(data.count+'&nbsp;');
                    }
                }
            }    
        });
        
        
        PubSub.subscribe('RENDER-PRINT-AREA', function(msg, data){
            if (_.keys(data).length && _.has(data, 'target') && data.target === context.mode){
                context.renderToPrintArea();
            }
        });
        
        // set the filter on the previewed update set collection and re-render with the filter applied
        PubSub.subscribe( 'PREVIEWED-FILTER', function(msg, data){
            if (context.mode === 'previewed' ){
                if (_.keys(data).length && _.has(data, 'filter_options')){
                    context._set('filter', data.filter_options);
                    context.render(true); // silent render - no pubsub events fired
                }
            }
        });
        
        // expand or collapse the list of collisions under each update set
        PubSub.subscribe( 'PREVIEWED-TOGGLE-COLLISIONS', function(msg, data){
            if (context.mode === 'previewed' ){
                common.debug('here1 '+JSON.stringify(data));
                if (_.keys(data).length && _.has(data, 'hide') && _.isBoolean(data.hide)){
                    context.toggleCollisions(data.hide);
                }
            }
        });
        
              
        // pubsub listeners
        PubSub.subscribe( 'RENDER', function(msg, data){
            if (_.keys(data).length){
                
                if (_.has(data, 'target') && data.target === 'update-sets'){
                    if (_.has(data, 'reset') && data.reset){
                        context.reset(true);
                    } 
                    else if ( _.has(data, 'mode') && data.mode === context.mode){
                        context.render();
                        PubSub.publish( 'NAV.SELECT', {'tab_name': context.mode});
                    }
                }
            }
        });
        

    },
    
    
    /**
      clear collection and render
      @method reset
      @param {boolean} silent - pass through to render method 
       if silent = true do not emit pubsub messages after render
    */
    reset: function(silent){
        this.collection.reset(null);
        this.render(silent);  
        this.$el.find('.panel-title .count').html(''); 
        var $target = this.$el.closest('.panel').find('.panel-title .count');
        if ($target.length){
            $target.html('');
        }        
    },
    
    
    /**
      @method render
      @param {boolean} silent  if silent = true do not emit pubsub messages after render
    */
	render : function(silent){
		if (!_.isBoolean(silent)){
            silent = false;
        }
        //console.log(this.el)
        this.$el.empty();
        var template_key = this.mode+this.list_template_postfix;
        var tmplatefx = _.template(this.templates[template_key]);
        //console.log(JSON.stringify(this.collection.models))
        
        var models = this.collection.filter(this._get('filter'));
        
        this.$el.append(tmplatefx({'models': models}));
      
        
        if (this.mode === 'previewed' && !silent){
            PubSub.publish( 'RENDER', {'target': 'preview-controls', 'count': models.length});
            
        }    

	},
    
    /**
      print the update set collection to the printable area of the page
      @meathod renderToPrintArea
    */
    renderToPrintArea : function(){
        
        var template_key = this.mode+this.list_template_postfix;
        var tmplatefx = _.template(this.templates[template_key]);
        $j('#printable-area').empty();
        $j('#printable-area').append(tmplatefx({'models':this.collection.filter(this._get('filter'))}));
        PubSub.publish('OPEN-PRINT-DIALOG');
    },
    
    
    /**
      toogle the collisions list for each update set
      @method toggleCollisions
      @param {boolean} hideCollisions
    */
    toggleCollisions : function(hideCollisions){
        if (this.mode === 'previewed' && _.isBoolean(hideCollisions)){
            this.$el.find('.list-group a[data-toggle="collapse"]').each(function(v,k){
                var $target = $j(this);
                common.debug($target);
                if (hideCollisions && (!$target.hasClass('collapsed'))){
                    $target.trigger('click');
                } 
                if ((!hideCollisions) && $target.hasClass('collapsed')){
                    $target.trigger('click');
                } 
               
            });
            
        }
        
    },
});




var PreviewControlsView = Backbone.View.extend({
	
    events: {
        'change .preview-controls .show-text-filter input' : 'textFilterCheckHandler',
        'change .preview-controls .minimize-collisions input' : 'toggleCollisionsExpanded',
        'change .preview-controls .collision-filter select' : 'getFilterOptions',
        'keyup .text-filter input' : 'getFilterOptions',
        'click .print-icon' : 'printClickHandler',
    },
    
    
    
    initialize: function (options) {
        var context = this;
        
        this.template_name = 'preview_controls';
        this.getTemplate(this.template_name);
        
        // pubsub listeners
        PubSub.subscribe( 'RENDER', function(msg, data){
            if (_.keys(data).length && _.has(data, 'target') && data.target === 'preview-controls'){
                context.render(data);
            }
        });      

        PubSub.subscribe( 'OPEN-PRINT-DIALOG', function(msg, data){
           context.openPrintDialog();
        }); 
           
    },    
    
    render : function(data){
		common.debug(this.el);
        this.$el.empty();

        var tmplatefx = _.template(this.templates[this.template_name]);
        //console.log(JSON.stringify(this.collection.models))
        
        this.$el.append(tmplatefx(data));

	},
    
    /**
      request the currently displayed preview report rendered to the printable area hidden div
      @method printClickHandler
      
    */
    printClickHandler : function(e){
        PubSub.publish('RENDER-PRINT-AREA', {'target': 'previewed'});
    },
    
    /**
      open a print dialog for the contents of the printable area 
      @method openPrintDialog
      @link http://stackoverflow.com/questions/16894683/how-to-print-html-content-on-click-of-a-button-but-not-the-page
    */
    openPrintDialog : function(){

        var previewed_html = $j('#printable-area').html();
        //common.debug(previewed_html)
        var mywindow = window.open('', 'my div', 'height=600,width=800');
        mywindow.document.write('<html><head><title>Previewed Update Sets</title>');
        /*stylesheets*/
        mywindow.document.write('<link rel="stylesheet" href="bd138a980f8ce600a95eb97ce1050ec8.cssdbx" type="text/css" />'); // bootstrap
        mywindow.document.write('<link rel="stylesheet" href="1773c2980f8ce600a95eb97ce1050e68.cssdbx" type="text/css" />'); // app
        mywindow.document.write('</head><body >');
        mywindow.document.write(previewed_html);
        mywindow.document.write('</body></html>');
        
        // wait just a moment before calling the print command
        setTimeout(function(){
             mywindow.print();
            //mywindow.close();
        }, 1000);
       
    },
        
    /**
      toggle display of the preview results text filter
      @method textFilterCheckHandler
    */
    textFilterCheckHandler : function(e){
        var context = this;
        var $el = this.$el.find('.text-filter');
        if ($el.length){
            if ($el.hasClass('hidden')){
                $el.hide().removeClass('hidden').slideDown(250);
            }
            else{
                $el.slideUp(250, function(){
                    var $target = context.$el.find('.text-filter input')
                    $target.val('');
                    $target.trigger('keyup');
                    $el.addClass('hidden');
                });
            }
            
        }
    },
    
    /**
      hide or show the collion details for each update set report
      @method toggleCollisionsExpanded
    */
    toggleCollisionsExpanded : function(e){
        common.debug('toggle collisions');
        PubSub.publish( 'PREVIEWED-TOGGLE-COLLISIONS', {'hide': $j(e.target).prop('checked')});
    },
    
    /**
      collection the currently selected filter options
      @method getFilterOptions
    */
    getFilterOptions : function(){
        var filters = {};
        this.$el.find('form .filter').each(function(){
            var tag_name = $j(this).prop('tagName').toLowerCase();
            var name_attr = $j(this).attr('name').toLowerCase();
            if ( tag_name === 'input'){
                var elem_type = $j(this).attr('type').toLowerCase();
                if (elem_type === 'checkbox'){
                    filters[name_attr] = $j(this).prop('checked');
                }
                else if (elem_type === 'text' ){
                    filters[name_attr] = $j(this).val();
                }
            }
            else if (tag_name === 'select'){
                filters[name_attr] = $j(this).val();
            }
            
        });
        common.debug('filters: '+JSON.stringify(filters));
        PubSub.publish( 'PREVIEWED-FILTER', {'filter_options': filters});
    },
});


// app starts here
$j(document).ready(function(){
    var app = new Application( {'el': $j('#app')} );

    app.render();
});
