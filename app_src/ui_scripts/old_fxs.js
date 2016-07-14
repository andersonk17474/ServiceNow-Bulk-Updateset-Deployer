/**
      start the updateset deploy process by reading the remote update sets
      @method getRemoteUpdateSets
    */
    getRemoteUpdateSets : function (data){
        var context = this;
        // clear the script log
        context.views.script_output.reset();
        // clear the retreieved update set log
        
        // clear the preview 
        
        
        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response));
            var data = common.extractJSON(response);
            context.getLogEntries(context.getTimeStamp());
            if (data && _.has(data, 'worker_id') && data.worker_id.length){
                common.debug('worker id: '+data.worker_id);
                context.workerManager(data.worker_id, 'retrieve');
            }

        };

        if (_.keys(data).length){
        
            common.debug('date format: '+common.get('SNOW_DATE_FORMAT'));
            common.debug(JSON.stringify(data));
            common.clientLog('start update set deployment process');
            common.debug(data);
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','retrieveRemoteUpdateSets');
            ga.addParam('sysparm_data',JSON.stringify(data));
            ga.getXML(callback);
        }
        
    },
    
    
    
    /**
     @method workerManager
     @param {string} progess workr sys_id
     @param {string} mode (retrieve, preview, commit)
    */
    workerManager : function(worker_id, mode, worker_completed){
        var context = this;
        if (_.isString(worker_id) && _.isString(mode)){
            if (!_.isBoolean(worker_completed)){
                this.worker_query_counter[mode] = 0;
                common.clientLog(mode +' update sets starting');
            }
            if (!worker_completed){
                common.debug(worker_id+', '+mode);
                var callback = function(response){
                    
                    var data = common.extractJSON(response);
                    common.debug('recieved: '+JSON.stringify(data));
                    if (data && _.has(data, 'completed')){
                        if (data.completed){
                            // get the list of fetched update sets and send to output
                            common.clientLog(mode +' update sets completed');
                            switch(mode.toLowerCase()){
                                case 'retrieve': 
                                    context.getRetrievedUpdateSetList();
                                    // fire off the update set preview workers 
                                    context.startPreviewUpdateSets();
                                break;
                                case 'preview': 
   
                                   
                                break;
                            
                            }
                        }
                        else if (context.worker_query_counter[mode] < common.get('WORKER_MAX_QUERY') ){
                            context.worker_query_counter[mode] ++;
                            setTimeout(function(){
                                common.clientLog(mode+' update set progress worker still executing, wait '+(common.get('WORKER_WAIT_TIME')/1000).toFixed(1)+'s and try again');
                                context.workerManager(worker_id, mode, false);
                            }, common.get('WORKER_WAIT_TIME'));
                        }
                        else{
                            console.error('Max progress worker query attempts reached, aborting. -workerManager::'+context.type);
                        }
                    }
                    else{
                        console.error('Error: invalid response from server - workerManager::'+context.type);
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
            
        }
        
        
    },
    
    /**
      call the server to begin previewing all retrieved update sets matching search params
      @method startPreviewUpdateSets
      
    */
    startPreviewUpdateSets : function(){
        var context = this;
        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response));
            var data = common.extractJSON(response);
            // need a time stamp for for when the ajax call started for this log fx to work
            //context.common.getLogEntries(context.common.getTimeStamp());
            if (data && _.has(data, 'workers') && _.has(data, 'transaction_id')){
                // we have recieved an array of progress workers
                
                // 6/28/2016
                // create a recursive fx for this component
                //--------------------------------------
                // ajax request for are all preview workers completed
                // keep calling this ajax fx until true
                // send transaction id and and array of workers
                // ajax call: areAllPreviewWorkersCompleted
                context.checkPreviewWorkersCompleted(data.workers, data.transaction_id);
                //context.common.workerManager(data.worker_id, 'preview');
            }

        };
        
        var params_obj = {'time_start': this.getTimeStamp()};
        _.extend(params_obj, this.search_params);

        common.clientLog('start updates set preview process');
        var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
        ga.addParam('sysparm_name','previewRetrievedUpdateSets');
        ga.addParam('sysparm_data',JSON.stringify(params_obj));
        ga.getXML(callback);

    },
    
    
    /**
      call the server to check if all the update set preview workers are completed
      @method checkPreviewWorkersCompleted
      @param {array} worker_ids
      @param {string} transaction_id
    */
    checkPreviewWorkersCompleted : function(worker_ids, transaction_id, counter){
        
        common.debug('start preview completed check '+counter);
        var context = this;
        if (!_.isNumber(counter)){
            counter = 0;
        }
        else{
            counter = counter +1;
        }
        
        var callback = function(response){
            common.debug('recieved: '+JSON.stringify(response));
            var data = common.extractJSON(response);
            // need a time stamp for for when the ajax call started for this log fx to work
            //context.common.getLogEntries(context.common.getTimeStamp());
            if (data && _.has(data, 'answer') && _.isBoolean(data.answer)){
                
                if (data.answer){
                    // get preview report
                    common.debug('get preview report');
                    context.getPreviewReport(context.remote_update_set_sys_ids);
                    
                }
                else if (counter < common.get('WORKER_MAX_QUERY')){
                    setTimeout(function(){
                        common.clientLog('update set preview progress workers are still executing, wait '+(common.get('WORKER_WAIT_TIME')/1000).toFixed(1)+'s and try again');
                        context.checkPreviewWorkersCompleted(worker_ids, transaction_id, counter); 
                    }, common.get('WORKER_WAIT_TIME'));
                }
                
            }

        };
        
        if (_.isArray(worker_ids) && worker_ids.length && _.isString(transaction_id) && transaction_id.length){
            
            var data = {
                'workers': worker_ids,
                'transaction_id': transaction_id,
                'time_start': this.getTimeStamp(),
            };
            common.debug(JSON.stringify(data));
            common.clientLog('checking update set preview process - attempt '+counter);
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','areAllPreviewWorkersCompleted');
            ga.addParam('sysparm_data',JSON.stringify(data));
            ga.getXML(callback);
        }
    },
    
    
    /**
      query db for all the retrieved update sets that match form search parameters
      @method getRetrievedUpdateSetList
    */
    getRetrievedUpdateSetList : function( ){
        var context = this;
        common.debug(this.search_params);
        var callback = function(response){
            var data = common.extractJSON(response);
            //console.log('recieved: '+JSON.stringify(data))
            if (data && _.has(data, 'update_sets')){
                context.remote_update_set_sys_ids = _.pluck(data.update_sets, 'sys_id');
                context.views.retreived_us.reset();
                context.views.retreived_us.collection.addRecords(data.update_sets);
                context.views.retreived_us.render();
            }
        };
        var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
        ga.addParam('sysparm_name','getRetrievedUpdateSets');
        ga.addParam('sysparm_data',JSON.stringify(this.search_params));
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
        var callback = function(response){
            var data = common.extractJSON(response);
            common.debug('recieved: '+JSON.stringify(data));
            context.views.previewed_us.reset();
            context.views.previewed_us.collection.addRecords(data);
            context.views.previewed_us.render();
            PubSub.publish( 'NAV.SELECT', {'tab_name': 'previewed'});
            
        };
        if (_.isArray(remote_update_set_sys_ids) && remote_update_set_sys_ids.length){
            var param_obj = {
                'time_start': this.getTimeStamp(),
                'sys_ids': remote_update_set_sys_ids,
            };
            common.debug(param_obj);
            var ga = new GlideAjax('Ajax_BulkUpdateSetDeploy');
            ga.addParam('sysparm_name','getPreviewReport');
            ga.addParam('sysparm_data',JSON.stringify(param_obj));
            ga.getXML(callback);
        }
    },
    
    /**
      set the class process start time variable
      @method setTimeStamp
      @param {string} datetime
    */
    
    setTimeStamp: function(date, time){
        // todo validate the date
        if (_.isString(date) && _.isString(time) && date.length && time.length){
            this._set('TIMESTAMP', {'date': date, 'time': time});
        }    
    },
    
    /**
      get the class process start time variable
      @method getTimeStamp 
      @param {string} datetime
    */
    getTimeStamp: function(){
        var result = '';
        var timestamp =  this._get('TIMESTAMP');
        if (_.has(timestamp, 'date') && _.has(timestamp, 'time')){
            result = timestamp.date+' '+timestamp.time;
        }
        return result;
    
    },