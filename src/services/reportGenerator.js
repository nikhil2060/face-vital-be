// services/reportGenerator.js
import { format } from "date-fns";

/**
 * Generate comprehensive vital signs report
 */
async function generateVitalReport(vitals, recordingDetails) {
  const timestamp = new Date();

  return {
    metadata: {
      reportId: generateReportId(),
      generatedAt: format(timestamp, "yyyy-MM-dd HH:mm:ss"),
      recordingDuration: recordingDetails.duration,
      recordingQuality: recordingDetails.videoQuality,
      processingQuality: vitals.signalQuality,
    },

    vitals: {
      heartRate: formatHeartRateData(vitals.heartRate),
      heartRateVariability: formatHRVData(vitals.hrv),
      respiratoryRate: formatRespiratoryData(vitals.respiratoryRate),
      bloodPressure: formatBloodPressureData(vitals.bloodPressure),
      stressLevel: formatStressData(vitals.stressLevel),
      mood: formatMoodData(vitals.mood),
      spO2: formatSpO2Data(vitals.spO2),
    },

    analysis: {
      summary: generateHealthSummary(vitals),
      concerns: identifyHealthConcerns(vitals),
      recommendations: generateRecommendations(vitals),
    },

    reliability: {
      overallConfidence: calculateOverallConfidence(vitals),
      measurementQuality: assessMeasurementQuality(vitals),
      limitations: identifyLimitations(vitals),
    },
  };
}

/**
 * Generate unique report identifier
 */
function generateReportId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `VR-${timestamp}-${random}`.toUpperCase();
}

/**
 * Format vital data functions
 */
function formatHeartRateData(heartRate) {
  return {
    value: heartRate.value,
    unit: "bpm",
    confidence: heartRate.confidence,
    interpretation: interpretHeartRate(heartRate.value),
    status: getHeartRateStatus(heartRate.value),
    range: {
      low: 60,
      high: 100,
      measured: heartRate.value,
    },
  };
}

function formatHRVData(hrv) {
  return {
    value: hrv.value,
    unit: "ms",
    confidence: hrv.confidence,
    interpretation: interpretHRV(hrv.value),
    status: getHRVStatus(hrv.value),
    range: {
      low: 20,
      high: 200,
      measured: hrv.value,
    },
  };
}

function formatRespiratoryData(respRate) {
  return {
    value: respRate.value,
    unit: "breaths/min",
    confidence: respRate.confidence,
    interpretation: interpretRespiratoryRate(respRate.value),
    status: getRespiratoryStatus(respRate.value),
    range: {
      low: 12,
      high: 20,
      measured: respRate.value,
    },
  };
}

function formatBloodPressureData(bp) {
  return {
    value: {
      systolic: bp.systolic,
      diastolic: bp.diastolic,
    },
    unit: "mmHg",
    confidence: bp.confidence,
    interpretation: interpretBloodPressure(bp),
    status: getBloodPressureStatus(bp),
    range: {
      systolic: {
        low: 90,
        high: 140,
        measured: bp.systolic,
      },
      diastolic: {
        low: 60,
        high: 90,
        measured: bp.diastolic,
      },
    },
  };
}

function formatStressData(stress) {
  return {
    value: stress.value,
    unit: "score",
    confidence: stress.confidence,
    interpretation: interpretStressLevel(stress.value),
    status: getStressStatus(stress.value),
    range: {
      low: 0,
      high: 100,
      measured: stress.value,
    },
    recommendations: generateStressRecommendations(stress.value),
  };
}

function formatMoodData(mood) {
  return {
    value: mood.primary,
    confidence: mood.confidence,
    interpretation: interpretMood(mood),
    status: mood.primary,
    validStates: ["calm", "stressed", "active", "neutral"],
    suggestions: generateMoodSuggestions(mood),
  };
}

function formatSpO2Data(spO2) {
  if (!spO2 || spO2.value === null) {
    return {
      value: null,
      unit: "%",
      confidence: "low",
      interpretation: "Measurement failed",
      status: "unknown",
      range: {
        low: 95,
        high: 100,
        measured: null,
      },
      perfusionIndex: {
        value: null,
        range: {
          low: 0.5,
          high: 10,
          measured: null,
        },
      },
      quality: {
        value: null,
        range: {
          low: 0,
          high: 1,
          measured: null,
        },
      },
    };
  }

  return {
    value: spO2.value,
    unit: "%",
    confidence: spO2.confidence,
    interpretation: interpretSpO2(spO2.value),
    status: getSpO2Status(spO2.value),
    range: {
      low: 95,
      high: 100,
      measured: spO2.value,
    },
    perfusionIndex: {
      value: spO2.perfusionIndex,
      range: {
        low: 0.5,
        high: 10,
        measured: spO2.perfusionIndex,
      },
    },
    quality: {
      value: spO2.quality.score,
      confidence: spO2.quality.confidence,
      reliability: spO2.quality.reliability,
      range: {
        low: 0,
        high: 1,
        measured: spO2.quality.score,
      },
    },
  };
}

/**
 * Status determination functions
 */
function getHeartRateStatus(hr) {
  if (hr < 60) return "low";
  if (hr > 100) return "high";
  return "normal";
}

function getHRVStatus(hrv) {
  if (hrv < 20) return "low";
  if (hrv > 200) return "high";
  return "normal";
}

function getRespiratoryStatus(rate) {
  if (rate < 12) return "low";
  if (rate > 20) return "high";
  return "normal";
}

function getBloodPressureStatus(bp) {
  if (bp.systolic > 140 || bp.diastolic > 90) return "high";
  if (bp.systolic < 90 || bp.diastolic < 60) return "low";
  return "normal";
}

function getStressStatus(level) {
  if (level > 70) return "high";
  if (level > 40) return "moderate";
  return "low";
}

/**
 * Interpretation functions
 */
function interpretHeartRate(hr) {
  if (hr < 60) return "Below normal range (bradycardia)";
  if (hr > 100) return "Above normal range (tachycardia)";
  return "Within normal range";
}

function interpretHRV(hrv) {
  if (hrv < 20) return "Lower than optimal variability";
  if (hrv > 200) return "Higher than typical variability";
  return "Normal variability";
}

function interpretRespiratoryRate(rate) {
  if (rate < 12) return "Below normal range";
  if (rate > 20) return "Above normal range";
  return "Normal breathing rate";
}

function interpretBloodPressure(bp) {
  if (bp.systolic > 140 || bp.diastolic > 90) return "Elevated blood pressure";
  if (bp.systolic < 90 || bp.diastolic < 60) return "Low blood pressure";
  return "Normal blood pressure range";
}

function interpretStressLevel(level) {
  if (level > 70) return "High stress detected";
  if (level > 40) return "Moderate stress level";
  return "Low stress level";
}

function interpretMood(mood) {
  const interpretations = {
    stressed: "Signs of stress or anxiety detected",
    calm: "Relaxed and composed state",
    neutral: "Neutral emotional state",
    active: "Alert and engaged state",
  };
  return interpretations[mood.primary] || "Unable to determine mood";
}

/**
 * Recommendation generation functions
 */
function generateHealthSummary(vitals) {
  const concerns = [];
  const positives = [];

  if (vitals.heartRate.value < 60 || vitals.heartRate.value > 100) {
    concerns.push("Heart rate outside normal range");
  } else {
    positives.push("Heart rate within normal range");
  }

  if (vitals.hrv.value < 20) {
    concerns.push("Lower than optimal heart rate variability");
  } else {
    positives.push("Good heart rate variability");
  }

  if (vitals.stressLevel.value > 70) {
    concerns.push("Elevated stress levels detected");
  }

  if (vitals.spO2.value !== null) {
    if (vitals.spO2.value >= 95) {
      positives.push("Normal oxygen saturation levels");
    } else if (vitals.spO2.value >= 90) {
      concerns.push(
        `Mild reduction in oxygen saturation (${vitals.spO2.value}%)`
      );
    } else {
      concerns.push(
        `Low oxygen saturation (${vitals.spO2.value}%) - immediate attention recommended`
      );
    }
  }

  return {
    concerns,
    positives,
    overallStatus: concerns.length === 0 ? "Healthy" : "Needs Attention",
  };
}

function generateRecommendations(vitals) {
  const recommendations = [];

  if (vitals.heartRate.value > 100) {
    recommendations.push({
      category: "Heart Health",
      suggestions: [
        "Practice deep breathing exercises",
        "Maintain regular physical activity",
        "Ensure adequate sleep",
      ],
    });
  }

  if (vitals.stressLevel.value > 70) {
    recommendations.push({
      category: "Stress Management",
      suggestions: [
        "Practice mindfulness or meditation",
        "Take regular breaks during work",
        "Consider stress-reducing activities",
      ],
    });
  }

  if (vitals.spO2.value !== null && vitals.spO2.value < 95) {
    recommendations.push({
      category: "Oxygen Saturation",
      suggestions: [
        vitals.spO2.value < 90
          ? "Seek immediate medical attention if low oxygen persists"
          : "Consider following up with healthcare provider",
        "Practice deep breathing exercises",
        "Ensure proper ventilation in your environment",
        "Consider position changes to optimize breathing",
        "Monitor for any breathing difficulties",
      ],
    });
  }

  return recommendations;
}

function generateStressRecommendations(level) {
  if (level > 70) {
    return [
      "Practice deep breathing exercises",
      "Consider meditation or mindfulness",
      "Take regular breaks",
      "Ensure adequate sleep",
      "Consider consulting a healthcare professional",
    ];
  } else if (level > 40) {
    return [
      "Take short breaks during work",
      "Practice simple relaxation techniques",
      "Maintain regular exercise",
      "Ensure work-life balance",
    ];
  }
  return [
    "Maintain current stress management practices",
    "Continue regular exercise",
    "Keep up healthy sleep habits",
  ];
}

function generateMoodSuggestions(mood) {
  const suggestions = {
    stressed: [
      "Practice relaxation techniques",
      "Take breaks when needed",
      "Consider mindfulness exercises",
    ],
    calm: [
      "Maintain current relaxation practices",
      "Continue balanced lifestyle",
    ],
    neutral: ["Consider engaging activities", "Maintain regular exercise"],
    active: [
      "Channel energy into productive tasks",
      "Maintain balanced activity levels",
    ],
  };
  return suggestions[mood.primary] || ["Maintain regular healthy habits"];
}

/**
 * Assessment and analysis functions
 */
function calculateOverallConfidence(vitals) {
  const confidenceScores = {
    high: 1,
    moderate: 0.6,
    low: 0.3,
  };

  const measurements = [
    vitals.heartRate,
    vitals.hrv,
    vitals.respiratoryRate,
    vitals.bloodPressure,
    vitals.stressLevel,
    vitals.spO2,
  ];

  const avgConfidence =
    measurements
      .map((m) => confidenceScores[m.confidence] || 0.5)
      .reduce((a, b) => a + b, 0) / measurements.length;

  return {
    score: avgConfidence,
    level:
      avgConfidence > 0.8 ? "high" : avgConfidence > 0.5 ? "moderate" : "low",
    factors: assessConfidenceFactors(vitals),
  };
}

function assessMeasurementQuality(vitals) {
  return {
    signalQuality: vitals.signalQuality.quality,
    confidence: vitals.signalQuality.confidence,
    factors: {
      lighting: assessLightingQuality(vitals.signalQuality),
      movement: assessMovementStability(vitals.signalQuality),
      duration: assessRecordingDuration(vitals),
    },
  };
}

function assessConfidenceFactors(vitals) {
  return {
    signalStrength: vitals.signalQuality.signalToNoise > 1.5 ? "good" : "poor",
    measurementStability:
      vitals.signalQuality.variability < 0.3 ? "stable" : "unstable",
    dataCompleteness:
      vitals.signalQuality.quality === "good" ? "complete" : "partial",
  };
}

function assessLightingQuality(signalQuality) {
  const snr = signalQuality.signalToNoise;
  if (snr > 2) return "good";
  if (snr > 1.5) return "adequate";
  return "poor";
}

function assessMovementStability(signalQuality) {
  const snr = signalQuality.signalToNoise;
  if (snr > 2.5) return "stable";
  if (snr > 1.5) return "moderate";
  return "unstable";
}

function assessRecordingDuration(vitals) {
  // This is a placeholder. Implement based on your requirements
  return "adequate";
}

/**
 * Health concern identification
 */
function identifyHealthConcerns(vitals) {
  const concerns = [];

  if (vitals.heartRate.value > 100) {
    concerns.push({
      type: "Elevated Heart Rate",
      severity: "Moderate",
      recommendation:
        "Consider relaxation techniques and consult healthcare provider if persistent",
    });
  }

  if (vitals.stressLevel.value > 70) {
    concerns.push({
      type: "High Stress",
      severity: "Moderate",
      recommendation:
        "Practice stress management techniques and ensure adequate rest",
    });
  }

  if (vitals.spO2.value !== null && vitals.spO2.value < 95) {
    concerns.push({
      type: "Reduced Oxygen Saturation",
      severity: vitals.spO2.value < 90 ? "High" : "Moderate",
      recommendation:
        vitals.spO2.value < 90
          ? "Seek immediate medical attention if this persists"
          : "Monitor oxygen levels and consult healthcare provider if persistent",
    });
  }

  return concerns;
}

function identifyLimitations(vitals) {
  const limitations = [];

  if (vitals.bloodPressure.confidence === "low") {
    limitations.push(
      "Blood pressure measurements are experimental and should not be used for medical purposes"
    );
  }

  if (vitals.signalQuality.quality === "poor") {
    limitations.push("Signal quality issues may affect measurement accuracy");
  }

  if (vitals.spO2.confidence === "low") {
    limitations.push(
      "Oxygen saturation measurements are experimental and should be verified with medical-grade equipment"
    );
  }

  return limitations;
}

//************************************SPO2 helper funtions********************************* */

function getSpO2Status(value) {
  if (value === null) return "unknown";
  if (value >= 95) return "normal";
  if (value >= 90) return "mild";
  if (value >= 85) return "moderate";
  return "severe";
}

/**
 * Interpret SpO2 levels
 */
function interpretSpO2(value) {
  if (value === null) return "Measurement failed";
  if (value >= 95) return "Normal oxygen saturation";
  if (value >= 90) return "Mild hypoxemia";
  if (value >= 85) return "Moderate hypoxemia";
  return "Severe hypoxemia";
}

// Export all necessary functions
export {
  generateVitalReport,
  generateRecommendations,
  calculateOverallConfidence,
  identifyHealthConcerns,
  identifyLimitations,
};
