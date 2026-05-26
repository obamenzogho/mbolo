export const FFmpegKit = {
  execute: async (command) => {
    console.log('[MOCK FFmpeg]', command);
    return {
      getReturnCode: async () => ({
        isValueSuccess: () => true,
        getValue: () => 0,
      }),
      getOutput: async () => '',
      getLogsAsString: async () => '',
    };
  },
  cancel: () => undefined,
};

export const FFprobeKit = {
  execute: async (command) => {
    console.log('[MOCK FFprobe]', command);
    return {
      getOutput: async () => JSON.stringify({
        streams: [{
          codec_type: 'video',
          duration: 15,
          width: 1080,
          height: 1920,
          r_frame_rate: '30/1',
          codec_name: 'mock',
        }],
        format: {
          duration: '15',
          bit_rate: '0',
          size: '0',
        },
      }),
    };
  },
};

export const FFmpeg = {};

export const trimVideo = async (inputUri) => inputUri;
export const addMusic = async (videoUri) => videoUri;
export const changeSpeed = async (inputUri) => inputUri;
export const mergeClips = async (clipUris) => clipUris[0];
export const applyColorFilter = async (inputUri) => inputUri;
export const compressVideo = async (inputUri) => inputUri;
export const getVideoInfo = async () => ({
  streams: [{
    duration: 15,
    width: 1080,
    height: 1920,
  }],
});
