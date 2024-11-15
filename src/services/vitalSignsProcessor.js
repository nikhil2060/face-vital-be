// services/vitalSignsProcessor.js
import * as tf from "@tensorflow/tfjs-node";
import { calculateSpO2 } from "./spO2Processor.js";

async function processVitalSigns(frameTensors) {
  const rppgSignal = await extractRPPGSignal(frameTensors);
  const signalQuality = calculateSignalQuality(rppgSignal);

  const heartRate = await calculateHeartRate(rppgSignal);
  const hrv = await calculateHRV(rppgSignal);
  const respiratoryRate = await calculateRespiratoryRate(frameTensors);
  const bloodPressure = await estimateBloodPressure(rppgSignal);
  const stressLevel = calculateStressLevel(hrv.value, respiratoryRate.value);
  const mood = await analyzeMood(frameTensors);
  const spO2 = await calculateSpO2(rppgSignal);

  return {
    heartRate,
    hrv,
    respiratoryRate,
    bloodPressure,
    stressLevel,
    mood,
    spO2,
    signalQuality,
  };
}

async function extractRPPGSignal(frameTensors) {
  const signals = [];

  for (const tensor of frameTensors) {
    const rgbMeans = tf.tidy(() => {
      const channels = tf.split(tensor, 3, 2);
      return channels.map((channel) => tf.mean(channel).dataSync()[0]);
    });
    signals.push(rgbMeans);
  }

  return signals;
}

async function calculateHeartRate(rppgSignal) {
  const greenChannel = rppgSignal.map((rgb) => rgb[1]);
  const peaks = detectPeaks(greenChannel);
  const duration = rppgSignal.length / 5; // 5 FPS
  const heartRate = (peaks.length * 60) / duration;

  return {
    value: Math.round(heartRate),
    unit: "bpm",
    confidence: calculateConfidence(peaks, "hr"),
    methodology: "rPPG color changes in face",
  };
}

async function calculateHRV(rppgSignal) {
  const greenChannel = rppgSignal.map((rgb) => rgb[1]);
  const peaks = detectPeaks(greenChannel);
  const rrIntervals = peaks.slice(1).map((peak, i) => {
    return ((peak - peaks[i]) / 5) * 1000; // Convert to ms
  });

  const rmssd = calculateRMSSD(rrIntervals);

  return {
    value: Math.round(rmssd),
    unit: "ms",
    confidence: calculateConfidence(rrIntervals, "hrv"),
    methodology: "rPPG signal interval analysis",
  };
}

async function calculateRespiratoryRate(frameTensors) {
  const movements = [];

  for (let i = 1; i < frameTensors.length; i++) {
    const diff = tf.sub(frameTensors[i], frameTensors[i - 1]);
    const movement = tf.mean(tf.abs(diff)).dataSync()[0];
    movements.push(movement);
    diff.dispose();
  }

  const respiratoryCycles = countBreathingCycles(movements);
  const duration = frameTensors.length / 5; // 5 FPS
  const rate = (respiratoryCycles * 60) / duration;

  return {
    value: Math.round(rate),
    unit: "breaths/min",
    confidence: calculateConfidence(movements, "respiratory"),
    methodology: "Subtle head/chest movements",
  };
}

async function estimateBloodPressure(rppgSignal) {
  // Experimental BP estimation
  const greenChannel = rppgSignal.map((rgb) => rgb[1]);
  const peaks = detectPeaks(greenChannel);
  const peakAmplitudes = peaks.map((i) => greenChannel[i]);

  const systolic = 110 + Math.round(Math.std(peakAmplitudes) * 30);
  const diastolic = 70 + Math.round(Math.mean(peakAmplitudes) * 20);

  return {
    systolic,
    diastolic,
    unit: "mmHg",
    confidence: "low",
    methodology: "Experimental ML model with rPPG",
  };
}

async function analyzeMood(frameTensors) {
  // Simple mood detection based on face movement patterns
  const movements = [];

  for (let i = 1; i < frameTensors.length; i++) {
    const diff = tf.sub(frameTensors[i], frameTensors[i - 1]);
    const movement = tf.mean(tf.abs(diff)).dataSync()[0];
    movements.push(movement);
    diff.dispose();
  }

  const avgMovement = Math.mean(movements);
  const movementVariability = Math.std(movements);

  let primaryMood = "neutral";
  let confidence = "moderate";

  if (movementVariability > 0.2) {
    primaryMood = avgMovement > 0.15 ? "stressed" : "active";
  } else if (avgMovement < 0.05) {
    primaryMood = "calm";
  }

  return {
    primary: primaryMood,
    confidence,
    methodology: "Movement pattern analysis",
  };
}

function calculateStressLevel(hrvValue, respiratoryRate) {
  // Initialize stress score components
  let hrvScore = 0;
  let respiratoryScore = 0;

  // Score based on HRV (lower HRV typically indicates higher stress)
  if (hrvValue < 20) {
    hrvScore = 100;
  } else if (hrvValue < 30) {
    hrvScore = 80;
  } else if (hrvValue < 50) {
    hrvScore = 60;
  } else if (hrvValue < 100) {
    hrvScore = 40;
  } else {
    hrvScore = 20;
  }

  // Score based on respiratory rate (higher rate can indicate stress)
  if (respiratoryRate > 20) {
    respiratoryScore = 100;
  } else if (respiratoryRate > 18) {
    respiratoryScore = 80;
  } else if (respiratoryRate > 15) {
    respiratoryScore = 60;
  } else if (respiratoryRate > 12) {
    respiratoryScore = 40;
  } else {
    respiratoryScore = 20;
  }

  // Calculate final stress score (weighted average)
  const finalScore = Math.round(hrvScore * 0.7 + respiratoryScore * 0.3);

  return {
    value: finalScore,
    level: getStressLevel(finalScore),
    confidence:
      hrvValue < 10 || respiratoryRate < 8 || respiratoryRate > 25
        ? "low"
        : "moderate",
    methodology: "Combined HRV and respiratory analysis",
  };
}

// Helper functions
function detectPeaks(signal) {
  const peaks = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peaks.push(i);
    }
  }
  return peaks;
}

function calculateRMSSD(intervals) {
  if (!intervals.length) return 0;
  const differences = intervals.slice(1).map((interval, i) => {
    return Math.pow(interval - intervals[i], 2);
  });

  return Math.sqrt(
    differences.reduce((a, b) => a + b, 0) / differences.length || 1
  );
}

function countBreathingCycles(movements) {
  const threshold = Math.mean(movements) + Math.std(movements);
  let cycles = 0;

  for (let i = 1; i < movements.length - 1; i++) {
    if (
      movements[i] > threshold &&
      movements[i] > movements[i - 1] &&
      movements[i] > movements[i + 1]
    ) {
      cycles++;
    }
  }

  return cycles;
}

function calculateConfidence(data, metric) {
  const mean = Math.mean(data);
  const std = Math.std(data);
  const snr = mean / std;

  if (snr > 2) return "high";
  if (snr > 1) return "moderate";
  return "low";
}

function calculateSignalQuality(rppgSignal) {
  const greenChannel = rppgSignal.map((rgb) => rgb[1]);
  const mean = Math.mean(greenChannel);
  const std = Math.std(greenChannel);

  return {
    signalToNoise: mean / std,
    quality: mean / std > 1.5 ? "good" : "poor",
    confidence: mean / std > 2 ? "high" : "moderate",
  };
}

function getStressLevel(score) {
  if (score >= 80) return "very high";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  if (score >= 20) return "low";
  return "very low";
}

// Math helper functions
Math.mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
Math.std = (arr) => {
  const mean = Math.mean(arr);
  const variance =
    arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length || 1);
  return Math.sqrt(variance);
};

// Export the main function and any other needed functions
export { processVitalSigns, calculateStressLevel, calculateSignalQuality };
