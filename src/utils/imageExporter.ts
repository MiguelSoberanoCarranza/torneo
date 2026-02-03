import { domToPng } from 'modern-screenshot';

/**
 * Converts a URL to a Data URI (Base64).
 * This helps avoid CORS issues when drawing images to a canvas.
 * We add a timestamp to force a fresh request, bypassing potentially "opaque" cached responses.
 */
const urlToDataUri = async (url: string): Promise<string> => {
  try {
    // Check if it's already a data URL
    if (url.startsWith('data:')) return url;

    // Append cache buster to avoid browser caching issues with CORS
    // If the URL already has params, append with &, otherwise ?
    // Be careful with signed URLs - if it's a signed URL, modifying it might break the signature.
    // Supabase public URLs are usually safe to append to.
    const separator = url.includes('?') ? '&' : '?';
    const safeUrl = `${url}${separator}t=${Date.now()}`;

    const response = await fetch(safeUrl, { 
      mode: 'cors',
      cache: 'no-cache',
    });
    
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Failed to convert image to Base64 (fallback to original):', url, error);
    return url; 
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

  // 1. Process Images (<img> tags)
  const images = Array.from(clone.querySelectorAll('img'));
  if (clone.tagName === 'IMG') {
    images.push(clone as HTMLImageElement);
  }

  await Promise.all(
    images.map(async (img) => {
      if (img.src && !img.src.startsWith('data:')) {
        img.crossOrigin = 'anonymous'; 
        try {
          const dataUri = await urlToDataUri(img.src);
          img.src = dataUri;
          img.srcset = ''; // Clear srcset
        } catch (e) {
          // Ignore
        }
      }
    })
  );

  // 2. Process Background Images (optional, but good for completeness)
  // This can be slow for large trees, so we limit it or skip if performance is an issue.
  // For this app, most logos are <img> tags.
  
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
    // 1. Prepare (Clone & Base64)
    const processedNode = await prepareNodeForExport(elementIdOrRef);

    // 2. Mount specifically for capture
    cloneContainer = document.createElement('div');
    cloneContainer.style.position = 'absolute';
    cloneContainer.style.top = '-9999px';
    cloneContainer.style.left = '-9999px';
    // Fix width to ensure layout is identical
    cloneContainer.style.width = `${elementIdOrRef.offsetWidth}px`;
    cloneContainer.style.height = `${elementIdOrRef.offsetHeight}px`; // Fix height too
    cloneContainer.style.overflow = 'hidden'; // Clip any overflow
    
    cloneContainer.appendChild(processedNode);
    document.body.appendChild(cloneContainer);

    // 3. Fonts
    // modern-screenshot handles fonts decenty, but manual embedding is safer for custom Google Fonts
    const fontUrls = [
      'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap',
      'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
    ];
    
    // We can inject these into the clone as a <style> tag
    const cssContent = await Promise.all(
      fontUrls.map(url => fetch(url).then(res => res.text()).catch(() => ''))
    ).then(css => css.join('\n'));

    const styleTag = document.createElement('style');
    styleTag.innerHTML = cssContent;
    processedNode.appendChild(styleTag);

    // 4. Capture
    // modern-screenshot configuration
    const dataUrl = await domToPng(processedNode, {
      scale: 3, // High quality
      backgroundColor: '#0f172a', // Force background
      style: {
        fontFamily: 'Lexend, sans-serif',
        margin: '0',
      },
      features: {
        // Explicitly enable problematic CSS features if needed, 
        // default usually works.
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
