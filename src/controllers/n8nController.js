const logger = require("../utils/logger");
const GenerationJob = require("../models/GenerationJob");

class N8nController {
    constructor() {
        this.logger = logger;
    }

    async updateJobStatus(req, res) {
        this.logger.info("Received job status update");
        this.logger.info(`Job ID: ${req.body.jobId} | Status: ${req.body.status}`)
        res.sendStatus(200);

        try {
            const {jobId, status} = req.body;
            if (!jobId || !status) {
                throw new Error("Job ID or status not provided");
            }

            await GenerationJob.findByIdAndUpdate(jobId, {status: status}, {new: true}).exec();
        } catch (error) {
            this.logger.error(`Error updating job status for job ID ${req.body.jobId}\nError: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: "Error updating job status",
                error: error.message
            })
        }
    }
}

const n8nController = new N8nController();
module.exports = n8nController;