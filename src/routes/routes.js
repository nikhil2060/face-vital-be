import express from "express";
import { uploadConfig } from "../config/multer.js";
import {
  analyzeVideo,
  getAnalysisResult,
} from "../controllers/videoController.js";

import validateVideoUpload from "../middleware/validateVideo.js";
// import testVideo from "../controllers/testController.js";

const router = express.Router();

router.post(
  "/analyse",
  uploadConfig.single("video"),
  validateVideoUpload,
  analyzeVideo
);

router.get("/result/:analysisId", getAnalysisResult);

export default router;
