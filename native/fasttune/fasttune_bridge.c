#include <math.h>
#include <stdlib.h>
#include <emscripten/emscripten.h>

#include "pitch/_pitch_pef.h"

static PitchPEFObj s_pitch = NULL;

EMSCRIPTEN_KEEPALIVE
int ft_init(int sampleRate) {
  float lowFre = 55;
  float highFre = 500;
  float cutFre = 4000;
  int radix2Exp = 12;
  int slideLength = 1024;
  WindowType windowType = Window_Hamm;
  int isContinue = 0;

  if (s_pitch) {
    pitchPEFObj_free(s_pitch);
    s_pitch = NULL;
  }
  pitchPEFObj_new(&s_pitch, &sampleRate, &lowFre, &highFre, &cutFre,
                  &radix2Exp, &slideLength, &windowType,
                  NULL, NULL, NULL, &isContinue);
  return s_pitch ? 0 : -1;
}

static int compare_float(const void *left, const void *right) {
  const float a = *(const float *)left;
  const float b = *(const float *)right;
  return (a > b) - (a < b);
}

EMSCRIPTEN_KEEPALIVE
float ft_detect(float *data, int dataLength) {
  if (!s_pitch || !data || dataLength <= 0) return 0;

  const int timeLength = pitchPEFObj_calTimeLength(s_pitch, dataLength);
  if (timeLength <= 0) return 0;

  float *frequencies = (float *)malloc(sizeof(float) * timeLength);
  if (!frequencies) return 0;
  pitchPEFObj_pitch(s_pitch, data, dataLength, frequencies);

  int validCount = 0;
  for (int i = 0; i < timeLength; i++) {
    const float frequency = frequencies[i];
    if (isfinite(frequency) && frequency >= 55 && frequency <= 500) {
      frequencies[validCount++] = frequency;
    }
  }
  if (!validCount) {
    free(frequencies);
    return 0;
  }

  qsort(frequencies, validCount, sizeof(float), compare_float);
  const float result = validCount % 2
    ? frequencies[validCount / 2]
    : (frequencies[validCount / 2 - 1] + frequencies[validCount / 2]) / 2;
  free(frequencies);
  return result;
}

EMSCRIPTEN_KEEPALIVE
void ft_destroy() {
  if (s_pitch) {
    pitchPEFObj_free(s_pitch);
    s_pitch = NULL;
  }
}
