import { toPng } from 'html-to-image';

/**
 * Converts a URL to a Data URI (Base64).
 * This helps avoid CORS issues when drawing images to a canvas.
 */
const urlToDataUri = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Failed to convert image to Base64:', url, error);
    return url; // Fallback to original URL
  }
};

/**
 * Pre-processes a DOM element for export.
 * 1. Clone the node to avoid mutating the live UI.
 * 2. Convert all <img> srcs to Base64.
 * 3. Inline any other critical assets.
 */
const prepareNodeForExport = async (node: HTMLElement): Promise<HTMLElement> => {
  const clone = node.cloneNode(true) as HTMLElement;

  // 1. Process Images
  const images = Array.from(clone.querySelectorAll('img'));
  
  // Also check if the node itself is an image
  if (clone.tagName === 'IMG') {
    images.push(clone as HTMLImageElement);
  }

  await Promise.all(
    images.map(async (img) => {
      if (img.src && !img.src.startsWith('data:')) {
        // Force crossOrigin to anonymous just in case, though converting to Blob is better
        img.crossOrigin = 'anonymous'; 
        try {
          const dataUri = await urlToDataUri(img.src);
          img.src = dataUri;
          img.srcset = ''; // clear srcset to prevent browser from switching back
        } catch (e) {
          console.warn('Failed to process image:', img.src);
        }
      }
    })
  );

  // 2. Remove potentially problematic styles or elements if needed
  // For example, large blurs can be heavy, but we'll try to keep them for now.
  
  return clone;
};

interface ExportOptions {
  fileName?: string;
  debug?: boolean;
}

export const captureAndDownload = async (elementIdOrRef: HTMLElement | null, options: ExportOptions = {}) => {
  if (!elementIdOrRef) throw new Error('Element not found');

  const { fileName = 'export.png' } = options;

  let cloneContainer: HTMLDivElement | null = null;

  try {
    // 1. Prepare the node (Clone & Base64 Conversion)
    const processedNode = await prepareNodeForExport(elementIdOrRef);

    // 2. Mount the clone specifically for capture
    // We place it off-screen but ensure it's rendered
    cloneContainer = document.createElement('div');
    cloneContainer.style.position = 'absolute';
    cloneContainer.style.top = '-9999px';
    cloneContainer.style.left = '-9999px';
    // Copy width/height if needed, or let it flow. 
    // Usually best to match the original width to ensure layout consistency.
    cloneContainer.style.width = `${elementIdOrRef.offsetWidth}px`; 
    cloneContainer.appendChild(processedNode);
    document.body.appendChild(cloneContainer);

    // 3. Fetch Fonts
    const fontUrls = [
      'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap',
      'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
    ];
    
    const fontEmbedCSS = await Promise.all(
      fontUrls.map(url => fetch(url).then(res => res.text()).catch(() => ''))
    ).then(css => css.join('\n'));

    // 4. Capture
    // Note: We capture 'processedNode' which is now in the DOM
    const dataUrl = await toPng(processedNode, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#0f172a',
      fontEmbedCSS,
      // We don't use 'filter' here effectively because we already filtered/modified the clone
      style: {
        fontFamily: 'Lexend, sans-serif',
        // Ensure the clone has no transform that might shift it out of view
        transform: 'none', 
        margin: '0',
      }
    });

    // 5. Download
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  } finally {
    // 6. Cleanup
    if (cloneContainer && cloneContainer.parentNode) {
      cloneContainer.parentNode.removeChild(cloneContainer);
    }
  }
};
