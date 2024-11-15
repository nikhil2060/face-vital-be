// controllers/videoController.js
import { extractFramesFromVideo } from "../services/videoService.js";
import { processVitalSigns } from "../services/vitalSignsProcessor.js";
import { generateVitalReport } from "../services/reportGenerator.js";
import * as tf from "@tensorflow/tfjs-node";

export const analyzeVideo = async (req, res) => {
  try {
    const videoFile = req.file;

    // Extract frames from the uploaded video
    const frameBuffers = await extractFramesFromVideo(videoFile.path);

    // Convert frame buffers to tensors
    const frameTensors = await Promise.all(
      frameBuffers.map((buffer) => tf.node.decodeImage(buffer, 3))
    );

    // Process vital signs
    const vitals = await processVitalSigns(frameTensors);

    console.log(vitals);

    // Generate detailed report
    const report = await generateVitalReport(vitals, {
      duration: frameTensors.length / 5, // 5 FPS
      timestamp: new Date(),
      videoQuality: req.videoQuality, // From your validation middleware
    });

    // Cleanup tensors
    frameTensors.forEach((tensor) => tensor.dispose());

    // You might want to store the report in your database here
    // const savedReport = await Report.create(report);

    res.status(200).json({
      success: true,
      message: "Video analysis completed successfully",
      report,
    });
  } catch (error) {
    console.error("Video analysis error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze video",
      error: error.message,
    });
  }
};

export const getAnalysisResult = async (req, res) => {
  try {
    const { analysisId } = req.params;

    // Implement fetching analysis result from your database
    // const report = await Report.findById(analysisId);

    // Temporary response until database implementation
    res.status(200).json({
      success: true,
      message: "Analysis result retrieved",
      analysisId,
      status: "pending",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve analysis result",
      error: error.message,
    });
  }
};
