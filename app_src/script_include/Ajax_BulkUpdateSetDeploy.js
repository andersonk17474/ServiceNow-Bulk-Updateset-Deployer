var Ajax_BulkUpdateSetDeploy = Class.create();
Ajax_BulkUpdateSetDeploy.prototype = Object.extendsObject(AbstractAjaxProcessor, {

    retrieveRemoteUpdateSets : function(params_obj){
        var result = {};
        var json = new JSON();
        var encode_answer = false;
        
        try{
            gs.include('underscorejs.min');  
           

            // used for testing from background script module
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
            
            var usd = new BulkUpdateSetDeployer();
            
           
            // fetch remote upodate sets
            if (_.has(params_obj, 'remote-host') && this.isValidSysId (params_obj['remote-host'])){
                result.worker_id = usd.retrieveRemoteUpdateSets(params_obj['remote-host']);
            }
            else{
                throw new Error('missing or invalid parameter "remote-host"');
            }
        }
        catch(e){
            result.error = e.message;
        }    
        if(encode_answer){
            result = json.encode(result);
        } 
        
        return result;
    },
    
    /**
      valid sys_id is alpha numeric only and 32 chars
      @method isValidSysId
      @param {string} str
      @returns {boolean}
    */
    isValidSysId : function(str){
        var result = false;
        var regex = /^[a-zA-Z0-9]+$/;
        if (_.isString(str) && str.length === 32 && regex.test(str)){
            result = true;
        }
        return result;
    },

    /**
      @method getLogOutput
      @param {string} params_obj {'created_after_date': [date string]}
    */
    getLogOutput : function(params_obj){
        var result = []; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        
        if (_.has(params_obj, 'created_after_date') && _.isString(params_obj.created_after_date)){
            var usd = new BulkUpdateSetDeployer();
            result = usd.getLogOutput(params_obj.created_after_date);
        }
        
        if (encode_answer){
            return json.encode({'logs': result});
        }
        else{
            return result;
        }
    }, 


    /**
      @method isProgressWorkerCompleted
      @param {object} params_obj
    */
    isProgressWorkerCompleted : function(params_obj){
        var result = { 'completed': false }; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        
        if (_.has(params_obj, 'worker_id') && _.isString(params_obj.worker_id)){
            result.worker_id = params_obj.worker_id;
            var usd = new BulkUpdateSetDeployer();
            if (usd.checkWorkerState(params_obj.worker_id)){
                result.completed = true;
            }
        }
        
        if (encode_answer){
            return json.encode(result);
        }
        else{
            return result;
        }
    }, 


    /**
      @method deleteRetrievedUpdateSets
      @param {string} params_obj {'created_after_date': [date string], 'release_date': [date string],}
    */
    deleteRetrievedUpdateSets : function(params_obj){
        var result = {};
        var json = new JSON();
        gs.include('underscorejs.min'); 
        gs.include("j2js");
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        
        result.worker_id = '';
        
        if (_.has(params_obj, 'created_after_date') || _.has(params_obj, 'release_date') ||  _.has(params_obj, 'sys_ids') ){
            var dru = new DeleteRetrievedUpdateSets(); 

            // translate the sys_ids array to a comma delim string if needed
            var sys_ids = '';
            if (_.isArray(params_obj.sys_ids)){
                sys_ids = params_obj.sys_ids.join(',');
            }
            else if (_.isString(params_obj.sys_ids)){
                sys_ids = params_obj.sys_ids;
            }

            result.targets =  dru.getMatching(params_obj.created_after_date, params_obj.release_date, params_obj['name-contains'], params_obj['name-does-not-contain'], sys_ids); 
            if (result.targets.length){
                var worker = new GlideScriptedProgressWorker(); 
                worker.setProgressName('Delete Retrieved Update Sets'); 
                worker.setName('DeleteRetrievedUpdateSets'); 
                // send an empty string as a progress worker parameter when the params_obj value is null
                worker.addParameter((params_obj.created_after_date || '')); 
                worker.addParameter((params_obj.release_date || '')); 
                worker.addParameter((params_obj['name-contains'] || ''));
                worker.addParameter((params_obj['name-does-not-contain'] || ''));
                worker.addParameter(sys_ids);
                worker.setBackground(true); 
                result.worker_id = worker.getProgressID(); 
                worker.start(); 
                worker.setProgressMessage('Deleting matching entries from sys_remote_update_set');
            }
            
        }
       
        
        if (encode_answer){
            return json.encode(result);
        }
        else{
            return result;
        }
    },     
    
    
    /**
      @method getRetrievedUpdateSets
      @param {string} params_obj {'created_after_date': [date string], 'release_date': [date string],}
    */
    getRetrievedUpdateSets : function(params_obj){
        var result = []; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        
        var usd = new BulkUpdateSetDeployer();
        if (_.has(params_obj, 'created_after_date') || _.has(params_obj, 'release_date')){
            
            result = usd.getRetrievedUpdateSets(params_obj.created_after_date, params_obj.release_date, params_obj['name-contains'], params_obj['name-does-not-contain']);
        }
        else if (_.has(params_obj, 'sys_ids') && _.isArray(params_obj.sys_ids)){
            result = usd.getRetrievedUpdateSetsBySysID(params_obj.sys_ids);
        }
        
        if (encode_answer){
            return json.encode({'update_sets': result});
        }
        else{
            return result;
        }
    }, 


    /**
      @method getRetrievedUpdateSets
      @param {string} params_obj {'sys_ids': [array]}
    */
    checkRetrievedStatus : function(params_obj){
        var data = []; 
        var result = { 'error': false };
        var json = new JSON();
        try{
            gs.include('underscorejs.min'); 
            var encode_answer = false;
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
      
            if ((_.has(params_obj, 'names') && _.isArray(params_obj.names)) || (_.has(params_obj, 'sys_ids') && _.isArray(params_obj.sys_ids))){
         
                var usd = new BulkUpdateSetDeployer();
                data = usd.checkRetrievedStatus(params_obj);
            
            }
            else{
                throw new Error('missing or invalid parameter: "sys_ids"');
            }
            
            if (encode_answer){
                result = json.encode({'answer': data});
            }
            else{
                result = {'answer': data};
            }
      
        }
        catch(e){
            result.error = true;
            result.error_descr = e.message;
        }    
        return result;
    },     
    
    
    /**
      start update set preview for all remote update sets retrieved after target date (or matching release date)
      returnm progress worker id
      @method previewRetrievedUpdateSets
      @param {object} object containingcreated by or release date
      @return {object} list of progress workers, and the update set preview transaction id
    */
    previewRetrievedUpdateSets : function(params_obj){
        var result = {'workers': [], 'transaction_id': ''};

        var json = new JSON();
        var encode_answer = false;
        
        try{
            gs.include('underscorejs.min');  
           

            // used for testing from background script module
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
            
            var usd = new BulkUpdateSetDeployer();
            
                        
            // preview retrieved update sets
            if (_.has(params_obj, 'created_after_date') || _.has(params_obj, 'release_date') || _.has(params_obj, 'sys_ids')){
                result.workers = usd.previewUpdateSets(params_obj.created_after_date, params_obj.release_date, params_obj['name-contains'], params_obj['name-does-not-contain'], params_obj['sys_ids']);
                result.transaction_id = usd.getTransactionId();
            }
        }
        catch(e){
            result.error = e.message;
        }  
        
        if(encode_answer){
            return json.encode(result);
        } 
        else{
            return result;
        } 
    },
    
    
    /**
      start update set commit for matching update sets by sys_id
      returnm progress worker ids
      @method commitPreviewedUpdateSets 
      @param {object} object containing array of remote update set sysids under the key 
      @return {object} list of progress workers, and the update set preview transaction id
    */
    commitPreviewedUpdateSets : function(params_obj){
        var result = {'committed': []};

        var json = new JSON();
        var encode_answer = false;
        
        try{
            gs.include('underscorejs.min');  

            // used for testing from background script module
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
            
            var usd = new BulkUpdateSetDeployer();
            usd.config.set('transaction_id', gs.generateGUID());
            gs.log('auto commit start ', this.type);
            // commit update sets 
            if ( _.has(params_obj, 'local_sys_ids') && _.isArray(params_obj.local_sys_ids) ){
                _.each(params_obj.local_sys_ids, function(v, k){
                    var obj = usd.commitRemoteUpdateSet(v);
                    //gs.log(v+' commit result: '+json.encode(obj),this.type);
                    if (_.has(obj, 'worker_id') && _.has(obj, 'local_sys_id')){
                        result.committed.push(obj);
                    }
                }, this);
            }
            else{
                throw new Error('Missing or invalid parameter "local_sys_ids", expected array');
            }
        }
        catch(e){
            result.error = e.message;
        }  
        
        if(encode_answer){
            return json.encode(result);
        } 
        else{
            return result;
        } 
    },
    
    
    /**
      check if all the worker sys ids are in the completed state
      @method areAllWorkersCompleted
      @param {object} contains keys "start_time", 'transaction_id', and "workers". workers is an array of worker sysid 
      @returns {boolean}
    */
    areAllWorkersCompleted : function(params_obj){
        var result = {'answer' : false};
        var completed_count = 0;
        var json = new JSON();
        var encode_answer = false;
        
        try{
            gs.include('underscorejs.min');  

            // used for testing from background script module
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }

            if (_.has(params_obj, 'start_time') && _.isString(params_obj.start_time) ){
                var usd = new BulkUpdateSetDeployer();
                usd.setStartTime(params_obj.start_time);
                // preview retrieved update sets
                if (_.has(params_obj, 'workers') && _.has(params_obj, 'transaction_id') ){
                    completed_count = usd.getCompletedWorkerCountByTransaction(params_obj.transaction_id);
                    gs.print(_.isArray(params_obj.workers));
                    if (_.isArray(params_obj.workers) && completed_count >= params_obj.workers.length  ){
                        result.answer = true;
                        
                    }
                }
            }
        }
        catch(e){
            result.error = e.message;
        }    
        if(encode_answer){
            return json.encode(result);
        } 
        else {
            return result;
        }        
    },
    
    
    /**
      get the report for the retrieved update sets in the parameter list
      @method getPreviewReport
      @param {string} params_obj { 'local_sys_ids': [sys_id1, sys_id2,...]}
    */
    getPreviewReport : function(params_obj){
        try{
            var result = []; 
            var json = new JSON();
            gs.include('underscorejs.min'); 
            var encode_answer = false;
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
            var usd = new BulkUpdateSetDeployer();

            if (_.has(params_obj, 'local_sys_ids')){
                var local_sys_ids = j2js(params_obj.local_sys_ids);
                if (_.isString(local_sys_ids) && local_sys_ids.length){
                    local_sys_ids = local_sys_ids.split(',');
                }
                if ( _.isArray(local_sys_ids) && local_sys_ids.length){
                    _.each(local_sys_ids, function(v,k){
                        var report = usd.getUpdatesetPreviewReport(v);
                        if (_.keys(report).length){
                            result.push(report);
                        }
                        else{
                            throw new Error ('no preview found for update set with sys id: '+v);
                        }
                        
                    });
                }
                else{
                    throw new Error ('invalid type por parameter "local_sys_ids", expected array');
                }    
            }
            else{
                throw new Error('missing parameter "local_sys_ids"');
            }
        }
        catch(e){
            result = {
                'error' : e.message,
            };    
        }
        if (encode_answer){
            return json.encode(result);
        }
        else{
            return result;
        }
    }, 
    
    /**
      @method getCommitLogs
      @param {object} params_obj contains key "local_updateset_sysids", array of sysids for commited local update sets
      local_updateset_sysids correspond the the sys id of the retrieved update set
    */
    getCommitLogs : function(params_obj){
        var result = {
            data : [],
        }; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        try{
            var encode_answer = false;
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
            if (_.has(params_obj, 'local_updateset_sysids') && _.isArray(params_obj.local_updateset_sysids) ){
                _.each(params_obj.local_updateset_sysids, function(v,k){
                    var report_obj = { 
                        'local_sys_id' : v,
                        'logs' : [],
                    };
                   
                    var gr = new GlideRecord('sys_update_set_log');
                    // why the heck do we have 2 different sys ids coming in here?
                    var qc = gr.addQuery('update_set.sys_id', v);
                    qc.addOrCondition('update_set.remote_sys_id.sys_id', v);
                    gs.print('query for commit report: '+gr.getEncodedQuery());
                    gr.query();
                    var obj = {};
                    while (gr.next()){
                        obj = {
                           'status': gr.status.getDisplayValue(),  
                           'log' : gr.log.getDisplayValue(),
                           'created' : gr.sys_created_on.getDisplayValue(),
                        };
                        report_obj.logs.push(obj);
                    }
                    if (report_obj.logs.length){
                        // save the logs under the local update set sys_id key
                        result.data.push(report_obj);
                    }
                    
                });
            }
            else{
               throw new Error('missing or invalid parameter "local_updateset_sysids", expected array'); 
            }
        }
        catch(e){
            result.error = e.message;
                
        }    
        if (encode_answer){
            return json.encode(result);
        }
        else{
            return result;
        }
    }, 
    
    
    
    
    /**
      get timestamp in users timezone
      @method getTimeStamp
     
    */
    getTimeStamp : function(){
        var result = {};
        var json = new JSON();
        try {
            var datetime = gs.nowDateTime();
            var usd = new BulkUpdateSetDeployer();
            if (usd.isValidDateTime(datetime)) {

                var date = datetime.substring(0, 10);
                var time = datetime.substring(11);
                result = {'date': date, 'time': time, 'datetime': datetime};

            }
            else{
                throw new Error('Invalid system date format. Expected system date time format: "yyyy-MM-dd HH:mm:ss". Check Date and Time format in user settings');
            }
        }
        catch(e){
            result.error = e.message;
        }
        return json.encode(result);
        
    },
    
    type: 'Ajax_BulkUpdateSetDeploy',
});
