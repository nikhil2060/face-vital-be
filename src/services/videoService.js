// videoService.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import path from "path";
import * as tf from "@tensorflow/tfjs-node";

// Configuration constants
export const VIDEO_CONFIG = {
  MIN_FRAMES: 20,
  MAX_FRAMES: 40,
  BASE_FPS: 5,
  QUALITY_SCALE: 2,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  SUPPORTED_FORMATS: [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
  ],
};

/**
 * Extract frames from video with adaptive frame rate
 */
export const extractFramesFromVideo = async (videoPath) => {
  const framesDir = path.join("uploads", `frames-${Date.now()}`);
  await fs.mkdir(framesDir, { recursive: true });

  const duration = await getVideoDuration(videoPath);
  const optimalFps = calculateOptimalFps(duration);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .fps(optimalFps)
      .videoFilters([
        `scale=iw/${VIDEO_CONFIG.QUALITY_SCALE}:-1`,
        "normalize",
        "unsharp=3:3:1.5:3:3:0.0",
      ])
      .outputOptions([
        "-q:v",
        "3",
        "-pix_fmt",
        "rgb24", // Ensure RGB output
        "-f",
        "image2", // Force image output format
      ])
      .on("end", async () => {
        try {
          const files = await fs.readdir(framesDir);
          const framePaths = files
            .filter((file) => file.endsWith(".png")) // Changed to PNG
            .sort((a, b) => {
              const numA = parseInt(a.match(/\d+/)[0]);
              const numB = parseInt(b.match(/\d+/)[0]);
              return numA - numB;
            })
            .map((file) => path.join(framesDir, file));

          // Load frames as buffers
          const frameBuffers = await Promise.all(
            sampleFrames(framePaths).map(async (framePath) => {
              const buffer = await fs.readFile(framePath);
              return buffer;
            })
          );

          // Clean up original frames after loading them into memory
          for (const framePath of framePaths) {
            await fs.unlink(framePath).catch(console.error);
          }
          await fs.rmdir(framesDir).catch(console.error);

          resolve(frameBuffers);
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (err) => reject(err))
      .save(`${framesDir}/frame-%d.png`); // Changed to PNG format
  });
};

/**
 * Calculate frame brightness
 */
export const calculateFrameBrightness = async (tensor) => {
  const grayscale = tf.mean(tensor, 2);
  const brightness = await tf.mean(grayscale).data();
  return brightness[0] / 255;
};

/**
 * Calculate optimal FPS based on video duration
 */
const calculateOptimalFps = (duration) => {
  const targetFrames = VIDEO_CONFIG.MAX_FRAMES;
  const calculatedFps = targetFrames / duration;
  return Math.max(VIDEO_CONFIG.BASE_FPS, Math.min(calculatedFps, 10));
};

/**
 * Get video duration using ffmpeg
 */
export const getVideoDuration = async (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      resolve(metadata.format.duration);
    });
  });
};

/**
 * Sample frames if we have too many
 */
const sampleFrames = (frames) => {
  if (frames.length <= VIDEO_CONFIG.MAX_FRAMES) return frames;

  const step = Math.ceil(frames.length / VIDEO_CONFIG.MAX_FRAMES);
  const sampledFrames = [];

  sampledFrames.push(frames[0]);
  for (let i = step; i < frames.length - step; i += step) {
    sampledFrames.push(frames[i]);
  }
  sampledFrames.push(frames[frames.length - 1]);

  return sampledFrames;
};

/**
 * Cleanup frames with error handling
 */
export const cleanupFrames = async (framePaths) => {
  // Since we're now handling cleanup in extractFramesFromVideo,
  // this function can be simplified
  try {
    if (Array.isArray(framePaths)) {
      framePaths.forEach((frame) => {
        // If frame is a buffer, we don't need to do anything
        // If it's a file path (legacy case), delete it
        if (typeof frame === "string") {
          fs.unlink(frame).catch(console.error);
        }
      });
    }
  } catch (error) {
    console.warn("Frame cleanup warning:", error);
  }
};

/**
 * Validate video file basics (size, type)
 */
export const validateVideoFile = (file) => {
  const validationResult = {
    isValid: true,
    errors: [],
  };

  if (!file) {
    validationResult.isValid = false;
    validationResult.errors.push({
      issue: "Missing file",
      fix: "Please ensure you've selected a video file before uploading.",
    });
    return validationResult;
  }

  if (file.size > VIDEO_CONFIG.MAX_FILE_SIZE) {
    validationResult.isValid = false;
    validationResult.errors.push({
      issue: "File size too large",
      details: `File size (${(file.size / (1024 * 1024)).toFixed(
        2
      )}MB) exceeds 50MB limit`,
      fixes: [
        "Compress your video",
        "Record a shorter duration",
        "Lower the video resolution while maintaining face visibility",
      ],
    });
  }

  if (!VIDEO_CONFIG.SUPPORTED_FORMATS.includes(file.mimetype)) {
    validationResult.isValid = false;
    validationResult.errors.push({
      issue: "Invalid file type",
      details: `File type "${file.mimetype}" is not supported`,
      fixes: [
        `Supported formats: ${VIDEO_CONFIG.SUPPORTED_FORMATS.join(", ")}`,
      ],
    });
  }

  return validationResult;
};
