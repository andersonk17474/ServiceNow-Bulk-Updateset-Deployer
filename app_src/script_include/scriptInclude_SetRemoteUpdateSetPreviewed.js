var SetRemoteUpdateSetPreviewed = Class.create();
SetRemoteUpdateSetPreviewed.prototype = {
    
    initialize: function() {
       
        
       
    },
    /**
      used by BulkUpdateSetDeployer to set the previewed flag on retrieved update sets after preview process workers complete
      @method process
    */
    process:function (worker_id, remote_update_sysid) {
		var usd = new BulkUpdateSetDeployer();
        if (usd.isValidWorkerID(worker_id) && usd.isValidSysId(remote_update_sysid)){
            if (usd.waitForWorkerComplete(worker_id).toLowerCase() === 'success'){
                usd.setRemoteUpdateSetPreviewed(remote_update_sysid);
                
                
            }
        }
	},

    type: 'SetRemoteUpdateSetPreviewed'
};