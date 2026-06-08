declare module 'blueimp-load-image' {
  interface LoadImageOptions {
    maxWidth?: number;
    maxHeight?: number;
    canvas?: boolean;
    orientation?: boolean;
    crop?: boolean;
    aspectRatio?: number;
    contain?: boolean;
    cover?: boolean;
    minWidth?: number;
    minHeight?: number;
    downscale?: boolean;
    meta?: boolean;
  }

  interface MetaData {
    exif?: {
      getOrientation(): number;
    };
  }

  type LoadImageCallback = (img: HTMLCanvasElement | HTMLImageElement | Event) => void;

  function loadImage(
    file: File | Blob | string,
    callback: LoadImageCallback,
    options: LoadImageOptions
  ): void;

  namespace loadImage {
    function parseMetaData(
      file: File | Blob | string,
      callback: (metadata: MetaData) => void
    ): void;
  }

  export default loadImage;
}
