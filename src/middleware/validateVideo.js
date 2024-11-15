import * as tf from "@tensorflow/tfjs-node";
import * as blazeface from "@tensorflow-models/blazeface";
import {
  extractFramesFromVideo,
  cleanupFrames,
} from "../services/videoService.js";

// Configuration constants
const CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MIN_FACE_VISIBILITY_RATIO: 0.6,
  MIN_CONFIDENCE: 0.7,
};

const validateVideoUpload = async (req, res, next) => {
  try {
    // Basic file validations
    if (!req.file) {
      return res.status(400).json({
        error: "No video file provided",
        fix: "Please ensure you've selected a video file before uploading",
      });
    }

    // File size validation
    if (req.file.size > CONFIG.MAX_FILE_SIZE) {
      return res.status(400).json({
        error: "File size too large",
        details: `File size (${(req.file.size / (1024 * 1024)).toFixed(
          2
        )}MB) exceeds 50MB limit`,
        fix: "Please compress your video or record a shorter duration",
      });
    }

    // Extract frames
    const frameBuffers = await extractFramesFromVideo(req.file.path);

    // Load BlazeFace model
    const model = await blazeface.load();

    // Process each frame for face detection
    let validFramesCount = 0;
    let totalConfidence = 0;
    let frameAnalysis = [];

    for (let i = 0; i < frameBuffers.length; i++) {
      let tensor;
      try {
        // Decode image buffer into a tensor
        tensor = tf.node.decodeImage(frameBuffers[i], 3);

        // Run face detection on the frame
        const predictions = await model.estimateFaces(tensor, {
          flipHorizontal: false,
        });

        if (predictions.length === 1) {
          validFramesCount++;
          const box = predictions[0].topLeft.concat(predictions[0].bottomRight);
          const boxSize = (box[2] - box[0]) * (box[3] - box[1]);
          const imageSize = tensor.shape[0] * tensor.shape[1];
          const confidence = Math.min((boxSize / imageSize) * 3, 1);
          totalConfidence += confidence;

          frameAnalysis.push({
            frameNumber: i + 1,
            hasFace: true,
            confidence: confidence,
            box: box,
          });
        } else {
          frameAnalysis.push({
            frameNumber: i + 1,
            hasFace: false,
            confidence: 0,
          });
        }
      } catch (error) {
        console.error(`Error processing frame ${i + 1}:`, error);
        frameAnalysis.push({
          frameNumber: i + 1,
          hasFace: false,
          confidence: 0,
          error: true,
        });
      } finally {
        if (tensor) tensor.dispose();
      }
    }

    // Calculate visibility and confidence metrics
    const faceVisibilityRatio = validFramesCount / frameBuffers.length;
    const averageConfidence =
      validFramesCount > 0 ? totalConfidence / validFramesCount : 0;

    // Analyze results and return issues if any
    const issues = [];

    if (faceVisibilityRatio < CONFIG.MIN_FACE_VISIBILITY_RATIO) {
      issues.push({
        issue: "Inconsistent face detection",
        details: `Face was only detected in ${Math.round(
          faceVisibilityRatio * 100
        )}% of frames (minimum required: 60%)`,
        fixes: [
          "Ensure your face is clearly visible and centered",
          "Maintain a consistent position",
          "Avoid rapid movements",
        ],
      });
    }

    if (averageConfidence < CONFIG.MIN_CONFIDENCE) {
      issues.push({
        issue: "Low face detection quality",
        details: `Average detection quality: ${Math.round(
          averageConfidence * 100
        )}% (minimum required: 70%)`,
        fixes: [
          "Move closer to the camera",
          "Ensure your full face is visible",
          "Face the camera directly",
          "Keep a stable position during recording",
        ],
      });
    }

    if (issues.length > 0) {
      return res.status(400).json({
        error: "Video validation failed",
        issues,
        metrics: {
          framesAnalyzed: frameBuffers.length,
          faceVisibilityPercentage: Math.round(faceVisibilityRatio * 100),
          averageDetectionQuality: Math.round(averageConfidence * 100),
        },
      });
    }

    req.faceDetection = {
      visibilityRatio: faceVisibilityRatio,
      averageConfidence,
      frameAnalysis,
    };
    next();
  } catch (error) {
    console.error("Video validation error:", error);
    return res.status(500).json({
      error: "Video processing failed",
      details: "An unexpected error occurred while processing your video",
      fix: "Please try uploading again or record a new video",
    });
  }
};

export default validateVideoUpload;
