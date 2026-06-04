export async function compressImage(file, maxWidth = 1920, quality = 0.88) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: outputType }) : file),
        outputType,
        quality
      );
    };
    img.src = url;
  });
}
