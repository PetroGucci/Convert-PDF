/* ====================================================
  Modal de edición (se usará para aplicar recorte y filtro)
==================================================== */
let cropper = null;
let editedImageData = null; // Se almacenará la imagen editada

function openEditor(dataURL) {
  const editorModal = document.getElementById('editorModal');
  const editorImage = document.getElementById('editorImage');
  editorImage.src = dataURL;
  if (cropper) { cropper.destroy(); }
  cropper = new Cropper(editorImage, {
    viewMode: 1,
    movable: true,
    zoomable: true,
    scalable: true,
    cropBoxResizable: true,
  });
  editorModal.style.display = 'block';
}

function closeEditor() {
  const editorModal = document.getElementById('editorModal');
  editorModal.style.display = 'none';
  if (cropper) { cropper.destroy(); cropper = null; }
}

document.getElementById('cancelEdit').addEventListener('click', closeEditor);

// Al pulsar "Descargar con filtro escáner" se toma el recorte, se aplica el filtro y se descarga
document.getElementById('applyEdit').addEventListener('click', () => {
  if (!cropper) return;
  const croppedCanvas = cropper.getCroppedCanvas();
  // Aplica el filtro de escáner al canvas recortado
  applyScanFilterToCanvas(croppedCanvas, croppedCanvas.width, croppedCanvas.height);
  const editedData = croppedCanvas.toDataURL('image/jpeg', 1.0); // Calidad máxima
  // Descarga según el tipo de archivo editado
  if (editFileType === "image") {
    const link = document.createElement('a');
    link.href = editedData;
    link.download = editFileName;
    link.click();
  } else if (editFileType === "pdf") {
    const { jsPDF } = window.jspdf;
    const img = new Image();
    img.onload = function() {
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height]
      });
      pdf.addImage(editedData, 'JPEG', 0, 0, img.width, img.height);
      pdf.save(editFileName.replace(/\.pdf$/, '.pdf'));
    };
    img.src = editedData;
  }
  closeEditor();
});

/* ====================================================
  Event listeners en section1 (se mantienen para expandir el área de drop)
==================================================== */
const section1 = document.getElementById('section1');
section1.addEventListener('dragover', (e) => { 
  e.preventDefault(); 
  section1.classList.add('dragover'); 
});
section1.addEventListener('dragleave', () => { 
  section1.classList.remove('dragover'); 
});
// Se usa en section1 para que al soltar el archivo se procese (área ampliada)
section1.addEventListener('drop', handleDropEvent);

/* ====================================================
  Unificación del drop zone para PDF e imágenes
  (Se conserva click y los eventos dragover/dragleave para efectos visuales)
==================================================== */
const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});
dropZone.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf, image/png, image/jpeg';
  input.multiple = true;
  input.click();
  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      // Para input se respeta el orden de selección
      handleFiles(Array.from(input.files));
    }
  });
});

/* ====================================================
  Variables globales para manejar el estado unificado
==================================================== */
let currentUnifiedType = ""; // "pdf" o "images"

/* ====================================================
  Función para resetear el estado de la zona unificada
==================================================== */
function resetUnifiedPDFState() {
  dropZone.textContent = 'Arrastra y suelta un archivo PDF o imagen aquí o haz clic para seleccionarlos';
  downloadBtn.style.display = 'none';
  downloadBtnBN.style.display = 'none';
  cancelExtractButton.style.display = 'none';
  generatePdfButton.style.display = 'none';
  generatePdfBNButton.style.display = 'none';
  cancelPdfButton.style.display = 'none';
  progressContainer.style.display = 'none';
  selectedImages = [];
  currentUnifiedType = "";
}

/* ====================================================
  Función auxiliar para obtener archivos preservando el orden de drop
==================================================== */
function getFilesFromDataTransfer(e) {
  let filesArray = [];
  if (e.dataTransfer.items) {
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) filesArray.push(file);
      }
    }
  } else {
    filesArray = Array.from(e.dataTransfer.files);
  }
  return filesArray;
}

/* ====================================================
  Función para manejar archivos recibidos (desde drop o input)
==================================================== */
function handleFiles(files) {
  if (files.length === 0) return;
  const file = files[0];
  if (file.type === 'application/pdf') {
    // Si ya había un PDF o imágenes cargadas, se reemplaza
    if (currentUnifiedType === "pdf" || currentUnifiedType === "images") {
      resetUnifiedPDFState();
    }
    currentUnifiedType = "pdf";
    dropZone.textContent = `Archivo cargado: ${file.name}`;
    cancelExtractButton.style.display = 'inline-block';
    extractImagesFromPdf(file);
  } else if (file.type.startsWith('image/')) {
    // Si anteriormente había un PDF, se reemplaza con imágenes
    if (currentUnifiedType === "pdf") {
      resetUnifiedPDFState();
    }
    // Si ya hay imágenes cargadas, se acumulan (manteniendo el orden)
    processImages(files);
  } else {
    alert('Por favor, sube un archivo válido (PDF o imagen).');
  }
}

// Usamos handleFiles tanto en el drop de section1 como en dropZone
function handleDropEvent(e) {
  e.preventDefault();
  section1.classList.remove('dragover');
  dropZone.classList.remove('dragover');
  const files = getFilesFromDataTransfer(e);
  handleFiles(files);
}

/* ====================================================
  Sección: Extraer imágenes de PDF (ya existente)
==================================================== */
const pdfCanvas = document.getElementById('pdfCanvas');
const ctx = pdfCanvas.getContext('2d');
const downloadBtn = document.getElementById('downloadAllImages');
const downloadBtnBN = document.getElementById('downloadAllImagesBN');
const cancelExtractButton = document.getElementById('cancelExtract');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');

async function extractImagesFromPdf(pdfFile) {
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  const fileReader = new FileReader();
  fileReader.onload = async function(e) {
    const pdfData = new Uint8Array(e.target.result);
    const pdf = await pdfjsLib.getDocument(pdfData).promise;
    const baseName = pdfFile.name.replace(/\.[^/.]+$/, "");
    const extractedImages = [];
    // Puedes aumentar el scale para mayor resolución (ej. scale: 3)
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      // Usa JPEG con calidad 1.0 o PNG para mayor calidad
      const imageData = pdfCanvas.toDataURL('image/jpeg', 1.0);
      extractedImages.push({ data: imageData, filename: `${baseName}-pagina-${i}.jpeg` });
      progressBar.style.width = ((i / pdf.numPages) * 100) + '%';
    }
    setTimeout(() => { progressContainer.style.display = 'none'; }, 500);
    downloadBtn.style.display = 'inline-block';
    downloadBtnBN.style.display = 'inline-block';
    downloadBtn.onclick = async function() {
      const zip = new JSZip();
      extractedImages.forEach(imgObj => {
        zip.file(imgObj.filename, imgObj.data.split(',')[1], { base64: true });
      });
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${baseName}.zip`;
      link.click();
      downloadBtn.style.display = 'none';
      downloadBtnBN.style.display = 'none';
      cancelExtractButton.style.display = 'none';
      dropZone.textContent = 'Arrastra y suelta un archivo PDF o imagen aquí o haz clic para seleccionarlos';
    };
    downloadBtnBN.onclick = async function() {
      const zip = new JSZip();
      for (const imgObj of extractedImages) {
        const grayDataURL = await convertDataURLWithScanFilter(imgObj.data);
        zip.file(imgObj.filename, grayDataURL.split(',')[1], { base64: true });
      }
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${baseName}.zip`;
      link.click();
      downloadBtn.style.display = 'none';
      downloadBtnBN.style.display = 'none';
      cancelExtractButton.style.display = 'none';
      dropZone.textContent = 'Arrastra y suelta un archivo PDF o imagen aquí o haz clic para seleccionarlos';
    };
  };
  fileReader.readAsArrayBuffer(pdfFile);
}

cancelExtractButton.addEventListener('click', () => {
  dropZone.textContent = 'Arrastra y suelta un archivo PDF o imagen aquí o haz clic para seleccionarlos';
  downloadBtn.style.display = 'none';
  downloadBtnBN.style.display = 'none';
  cancelExtractButton.style.display = 'none';
  progressContainer.style.display = 'none';
  currentUnifiedType = "";
});

/* ====================================================
  Funciones auxiliares para aplicar filtro escáner y cargar imágenes
==================================================== */
function applyScanFilterToCanvas(canvas, width, height) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrast = 2.6;
  const brightness = 10;
  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    gray = contrast * (gray - 128) + 128 + brightness;
    gray = Math.max(0, Math.min(255, gray));
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
}

function convertDataURLWithScanFilter(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const contrast = 2.6;
      const brightness = 10;
      for (let i = 0; i < data.length; i += 4) {
        let gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        gray = contrast * (gray - 128) + 128 + brightness;
        gray = Math.max(0, Math.min(255, gray));
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
    img.onerror = reject;
    img.src = dataURL;
  });
}

function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataURL;
  });
}

/* ====================================================
  Sección: Convertir imágenes a PDF (ya existente)
==================================================== */
const generatePdfButton = document.getElementById('generatePdf');
const generatePdfBNButton = document.getElementById('generatePdfBN');
const cancelPdfButton = document.getElementById('cancelPdf');
let selectedImages = []; // Imágenes seleccionadas para conversión

generatePdfButton.style.display = 'none';
generatePdfBNButton.style.display = 'none';
cancelPdfButton.style.display = 'none';

function processImages(files) {
  const newImages = Array.from(files).filter(file =>
    file.type === 'image/png' || file.type === 'image/jpeg'
  );
  if (currentUnifiedType !== "images") {
    // Si no hay imágenes ya cargadas, se reemplaza (o se limpió un PDF previo)
    selectedImages = newImages;
    currentUnifiedType = "images";
  } else {
    // Si ya hay imágenes, se acumulan (manteniendo el orden)
    selectedImages = selectedImages.concat(newImages);
  }
  if (selectedImages.length > 0) {
    dropZone.textContent = `${selectedImages.length} imágenes cargadas`;
    generatePdfButton.style.display = 'inline-block';
    generatePdfBNButton.style.display = 'inline-block';
    cancelPdfButton.style.display = 'inline-block';
  }
}

generatePdfButton.addEventListener('click', async () => {
  if (selectedImages.length === 0) return;
  const { jsPDF } = window.jspdf;
  let pdf = null;
  // Se recorre selectedImages en el orden en que fueron agregadas
  for (let i = 0; i < selectedImages.length; i++) {
    const file = selectedImages[i];
    const imgData = await readImageAsDataURL(file);
    const img = await loadImage(imgData);
    const width = img.width;
    const height = img.height;
    if (i === 0) {
      pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      });
    } else {
      pdf.addPage([width, height], width > height ? 'landscape' : 'portrait');
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
  }
  if (pdf) {
    pdf.save(selectedImages[0].name.replace(/\.[^/.]+$/, ".pdf"));
  }
  // Reiniciamos el estado, sin importar la cantidad de imágenes
  resetUnifiedPDFState();
});

generatePdfBNButton.addEventListener('click', async () => {
  if (selectedImages.length === 0) return;
  const { jsPDF } = window.jspdf;
  let pdf = null;
  for (let i = 0; i < selectedImages.length; i++) {
    const file = selectedImages[i];
    const imgData = await readImageAsDataURL(file);
    const img = await loadImage(imgData);
    const width = img.width;
    const height = img.height;
    // Crear un canvas para aplicar el filtro escáner
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    applyScanFilterToCanvas(canvas, width, height);
    const filteredImgData = canvas.toDataURL('image/jpeg', 1.0);
    if (i === 0) {
      pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      });
    } else {
      pdf.addPage([width, height], width > height ? 'landscape' : 'portrait');
    }
    pdf.addImage(filteredImgData, 'JPEG', 0, 0, width, height);
  }
  if (pdf) {
    pdf.save(selectedImages[0].name.replace(/\.[^/.]+$/, ".pdf"));
  }
  // Reiniciamos el estado
  resetUnifiedPDFState();
});

cancelPdfButton.addEventListener('click', () => {
  resetUnifiedPDFState();
});

/* ====================================================
  SECCIÓN: Editar imágenes o documentos sin conversión
  (Se deja intacta, ya que funciona correctamente)
==================================================== */
const editDropZone = document.getElementById('editDropZone');
const editPreviewContainer = document.getElementById('editPreviewContainer');
const editPreview = document.getElementById('editPreview');
const editPdfCanvas = document.getElementById('editPdfCanvas');
const openEditorButton = document.getElementById('openEditor');
const downloadEditedButton = document.getElementById('downloadEdited');
const cancelEditSectionButton = document.getElementById('cancelEditSection');

let editFileType = ""; // "image" o "pdf"
let editOriginalData = "";
let editOriginalMime = "";

editSection.addEventListener('dragover', (e) => { e.preventDefault(); editSection.classList.add('dragover'); });
editSection.addEventListener('dragleave', () => { editSection.classList.remove('dragover'); });
editSection.addEventListener('drop', (e) => { e.preventDefault(); editSection.classList.remove('dragover'); handleEditFile(e.dataTransfer.files[0]); });
editDropZone.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png, image/jpeg, application/pdf';
  input.click();
  input.addEventListener('change', () => { handleEditFile(input.files[0]); });
});

function handleEditFile(file) {
  if (!file) return;
  editFileName = file.name; // Guarda el nombre original del archivo
  editDropZone.textContent = `Archivo cargado: ${file.name}`;
  editPreviewContainer.style.display = 'none';
  cancelEditSectionButton.style.display = 'inline-block';
  openEditorButton.style.display = 'inline-block';
  downloadEditedButton.style.display = 'inline-block';
  // En edición, siempre se reemplaza la entrada (ya sea imagen o PDF)
  if (file.type.startsWith('image/')) {
    editFileType = "image";
    editOriginalMime = file.type;
    const reader = new FileReader();
    reader.onload = function(event) {
      editOriginalData = event.target.result;
      editPreview.src = editOriginalData;
      editPreview.style.display = 'none';
      editPdfCanvas.style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else if (file.type === 'application/pdf') {
    editFileType = "pdf";
    const fileReader = new FileReader();
    fileReader.onload = async function(event) {
      const pdfData = new Uint8Array(event.target.result);
      const pdf = await pdfjsLib.getDocument(pdfData).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      editPdfCanvas.width = viewport.width;
      editPdfCanvas.height = viewport.height;
      const ctx = editPdfCanvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      editOriginalData = editPdfCanvas.toDataURL('image/png');
      editPreview.style.display = 'none';
      editPdfCanvas.style.display = 'block';
    };
    fileReader.readAsArrayBuffer(file);
  } else {
    alert('Formato no soportado');
  }
  
  openEditorButton.addEventListener('click', () => {
    if (editOriginalData) { openEditor(editOriginalData); }
  });

  downloadEditedButton.addEventListener('click', () => {
    if (editFileType === "image") {
      const { jsPDF } = window.jspdf;
      // Abrir editor para aplicar recorte y filtro antes de descargar
      openEditor(editOriginalData);
      // La descarga se realizará al pulsar "Descargar con filtro escáner" en el modal
    } else if (editFileType === "pdf") {
      openEditor(editOriginalData);
    }
  });

  cancelEditSectionButton.addEventListener('click', () => {
    editDropZone.textContent = 'Arrastra y suelta una imagen o PDF aquí o haz clic para seleccionarlo';
    editPreviewContainer.style.display = 'none';
    openEditorButton.style.display = 'none';
    downloadEditedButton.style.display = 'none';
    cancelEditSectionButton.style.display = 'none';
    editOriginalData = "";
    editFileType = "";
  });
}
