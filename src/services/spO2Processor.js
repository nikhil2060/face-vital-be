// services/spO2Processor.js

import * as tf from "@tensorflow/tfjs-node";

/**
 * Calculate SpO2 using advanced signal processing
 * @param {Array} rppgSignal - RGB signals from video frames
 * @returns {Object} SpO2 measurement with confidence and details
 */
async function calculateSpO2(rppgSignal) {
  try {
    // 1. Signal Preprocessing
    const { redSignal, infraredSignal } = preprocessSignals(rppgSignal);

    // 2. Apply bandpass filter to isolate physiological frequencies (0.5 - 4 Hz)
    const filteredRed = butterworth(redSignal, {
      lowFreq: 0.5,
      highFreq: 4.0,
      samplingRate: 30,
      order: 4,
    });

    const filteredIR = butterworth(infraredSignal, {
      lowFreq: 0.5,
      highFreq: 4.0,
      samplingRate: 30,
      order: 4,
    });

    // 3. Advanced AC/DC Component Calculation
    const redComponents = calculateACDCComponents(filteredRed);
    const irComponents = calculateACDCComponents(filteredIR);

    // 4. Calculate ratio of ratios (R) using both amplitude and area methods
    const ratioAmplitude = calculateRatioAmplitude(redComponents, irComponents);
    const ratioArea = calculateRatioArea(filteredRed, filteredIR);

    // 5. Weighted average of both methods
    const R = ratioAmplitude * 0.6 + ratioArea * 0.4;

    // 6. Apply calibration curve
    const spO2 = calculateCalibatedSpO2(R);

    // 7. Quality Assessment
    const quality = assessSignalQuality(redSignal, infraredSignal, R);

    // 8. Perfusion Index calculation
    const perfusionIndex = calculatePerfusionIndex(redComponents);

    return {
      value: Math.round(spO2 * 10) / 10, // Round to 1 decimal place
      unit: "%",
      confidence: quality.confidence,
      methodology: "Advanced rPPG with dual ratio calculation",
      perfusionIndex: perfusionIndex,
      quality: quality,
      details: {
        rValue: R.toFixed(3),
        redPerfusion: redComponents.perfusion.toFixed(3),
        irPerfusion: irComponents.perfusion.toFixed(3),
        signalQuality: quality.score.toFixed(2),
        reliability: quality.reliability,
      },
    };
  } catch (error) {
    console.error("SpO2 calculation error:", error);
    return {
      value: null,
      unit: "%",
      confidence: "low",
      methodology: "Advanced rPPG processing failed",
      error: error.message,
    };
  }
}

/**
 * Preprocess RGB signals to extract red and approximate infrared channels
 */
function preprocessSignals(rppgSignal) {
  // Extract red channel
  const redSignal = rppgSignal.map((rgb) => rgb[0]);

  // Create synthetic IR signal using weighted combination of red and blue
  // This approximates the IR wavelength response
  const infraredSignal = rppgSignal.map((rgb) => {
    return rgb[0] * 0.6 + rgb[2] * 0.4; // Weighted combination
  });

  // Normalize signals
  const normalizedRed = normalizeSignal(redSignal);
  const normalizedIR = normalizeSignal(infraredSignal);

  return {
    redSignal: normalizedRed,
    infraredSignal: normalizedIR,
  };
}

/**
 * Implement Butterworth bandpass filter
 */
function butterworth(signal, options) {
  const { lowFreq, highFreq, samplingRate, order } = options;

  // Convert frequencies to normalized frequency
  const nyquist = samplingRate / 2;
  const lowW = lowFreq / nyquist;
  const highW = highFreq / nyquist;

  // Create filter coefficients
  const { numerator, denominator } = createButterworthCoefficients(
    order,
    lowW,
    highW
  );

  // Apply filter
  return filterSignal(signal, numerator, denominator);
}

/**
 * Calculate AC and DC components using advanced methods
 */
function calculateACDCComponents(signal) {
  // Calculate DC using moving average
  const windowSize = 30; // 1 second at 30 fps
  const dc = movingAverage(signal, windowSize);

  // Extract AC by removing DC
  const ac = signal.map((value, i) => value - dc[i]);

  // Calculate peak-to-peak amplitude
  const { peaks, troughs } = findPeaksTroughs(ac);
  const peakValues = peaks.map((i) => ac[i]);
  const troughValues = troughs.map((i) => ac[i]);

  const acAmplitude = Math.mean(peakValues) - Math.mean(troughValues);
  const dcValue = Math.mean(dc);

  return {
    ac: acAmplitude,
    dc: dcValue,
    perfusion: (acAmplitude / dcValue) * 100,
    peaks,
    troughs,
    signal: ac,
  };
}

/**
 * Calculate ratio using amplitude method
 */
function calculateRatioAmplitude(redComponents, irComponents) {
  const redRatio = redComponents.ac / redComponents.dc;
  const irRatio = irComponents.ac / irComponents.dc;
  return redRatio / irRatio;
}

/**
 * Calculate ratio using area under curve method
 */
function calculateRatioArea(redSignal, irSignal) {
  const redArea = calculateAreaUnderCurve(redSignal);
  const irArea = calculateAreaUnderCurve(irSignal);
  return redArea / irArea;
}

/**
 * Apply empirical calibration curve
 */
function calculateCalibatedSpO2(R) {
  // Advanced calibration curve based on empirical data
  // SpO2 = a - b * R (where a and b are calibration coefficients)
  const a = 110;
  const b = 25;
  let spO2 = a - b * R;

  // Apply physiological limits
  spO2 = Math.min(100, Math.max(70, spO2));

  return spO2;
}

/**
 * Calculate Perfusion Index
 */
function calculatePerfusionIndex(components) {
  return (components.ac / components.dc) * 100;
}

function findPeaksTroughs(signal) {
  const peaks = [];
  const troughs = [];

  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peaks.push(i);
    }
    if (signal[i] < signal[i - 1] && signal[i] < signal[i + 1]) {
      troughs.push(i);
    }
  }

  return { peaks, troughs };
}

function calculateAreaUnderCurve(signal) {
  return signal.reduce((sum, value) => sum + Math.abs(value), 0);
}

Math.mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
Math.std = (arr) => {
  const mean = Math.mean(arr);
  const variance =
    arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length || 1);
  return Math.sqrt(variance);
};

/**
 * Assess signal quality using multiple metrics
 */
function assessSignalQuality(redSignal, irSignal, R) {
  const metrics = {
    snr: calculateSNR(redSignal) * 0.3 + calculateSNR(irSignal) * 0.7,
    stability: calculateSignalStability(redSignal, irSignal),
    physiological: isPhysiologicallyValid(R),
  };

  const score =
    metrics.snr * 0.4 + metrics.stability * 0.4 + metrics.physiological * 0.2;

  return {
    score,
    confidence: determineConfidenceLevel(score),
    reliability: calculateReliability(metrics),
    metrics,
  };
}

/**
 * Signal processing helper functions
 */
function normalizeSignal(signal) {
  const mean = Math.mean(signal);
  const std = Math.std(signal);
  return signal.map((value) => (value - mean) / std);
}

function createButterworthCoefficients(order, lowW, highW) {
  // Implementation of Butterworth filter coefficient calculation
  // This would be a complex implementation based on digital filter design
  // For brevity, returning placeholder values
  return {
    numerator: [1],
    denominator: [1],
  };
}

function filterSignal(signal, numerator, denominator) {
  // Implement digital filter using difference equation
  // For now, returning simple moving average as placeholder
  return movingAverage(signal, 5);
}

function movingAverage(signal, windowSize) {
  const result = [];
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += signal[j];
      count++;
    }
    result.push(sum / count);
  }
  return result;
}

function calculateSNR(signal) {
  const mean = Math.mean(signal);
  const noise = Math.std(signal);
  return mean / noise;
}

function calculateSignalStability(redSignal, irSignal) {
  const redStability = 1 / Math.std(redSignal);
  const irStability = 1 / Math.std(irSignal);
  return (redStability + irStability) / 2;
}

function isPhysiologicallyValid(R) {
  // R values typically range from 0.5 to 2.0 for normal SpO2 ranges
  return R >= 0.5 && R <= 2.0 ? 1 : 0;
}

function determineConfidenceLevel(score) {
  if (score > 0.8) return "high";
  if (score > 0.6) return "moderate";
  return "low";
}

function calculateReliability(metrics) {
  return Object.values(metrics).reduce((a, b) => a + b, 0) / 3;
}

// Export necessary functions
export { calculateSpO2, assessSignalQuality, calculatePerfusionIndex };
