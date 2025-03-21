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
  sortImagesButton.style.display = 'none'; // Ocultar el botón "Ordenar Imágenes"
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

async function updateSortableImagesPreview() {
  sortableImages.innerHTML = '';
  const pageWidth = 595; // Ancho de página A4 en puntos
  const pageHeight = 842; // Altura de página A4 en puntos
  const canvasResolution = 3; // Aumentar resolución del lienzo

  for (let i = 0; i < selectedImages.length; i++) {
    const file = selectedImages[i];
    const imgData = await readImageAsDataURL(file);
    const img = await loadImage(imgData);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = pageWidth * canvasResolution;
    canvas.height = pageHeight * canvasResolution;
    ctx.scale(canvasResolution, canvasResolution); // Escalar para mayor resolución
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(pageWidth / img.width, pageHeight / img.height);
    const x = (pageWidth - img.width * scale) / 2;
    const y = (pageHeight - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    const previewData = canvas.toDataURL('image/jpeg', 0.95); // Alta calidad

    const imgElement = document.createElement('img');
    imgElement.src = previewData;
    imgElement.dataset.index = i;
    imgElement.addEventListener('click', () => {
      previewImage.src = imgElement.src;
      previewModal.style.display = 'flex';
    });

    const fileNameElement = document.createElement('div');
    fileNameElement.classList.add('file-name');
    fileNameElement.textContent = file.name;

    const deleteButton = document.createElement('button');
    deleteButton.classList.add('delete-button');
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => {
      selectedImages.splice(i, 1);
      updateSortableImagesPreview(); // Actualizar la vista previa
    });

    const sortableItem = document.createElement('div');
    sortableItem.classList.add('sortable-item');
    sortableItem.appendChild(imgElement);
    sortableItem.appendChild(fileNameElement);
    sortableItem.appendChild(deleteButton);

    sortableImages.appendChild(sortableItem);
  }
  sortableImages.appendChild(addMoreImagesButton); // Asegurarse de que el botón esté al final
}

function processImages(files) {
  const newImages = Array.from(files).filter(file =>
    file.type === 'image/png' || file.type === 'image/jpeg'
  );
  if (currentUnifiedType !== "images") {
    selectedImages = newImages;
    currentUnifiedType = "images";
  } else {
    selectedImages = selectedImages.concat(newImages);
  }
  if (selectedImages.length > 0) {
    dropZone.textContent = `${selectedImages.length} imágenes cargadas`;
    generatePdfButton.style.display = 'inline-block';
    generatePdfBNButton.style.display = 'inline-block';
    cancelPdfButton.style.display = 'inline-block';
    sortImagesButton.style.display = 'inline-block';
    updateSortableImagesPreview(); // Actualizar la vista previa
  }
}

generatePdfButton.addEventListener('click', async () => {
  if (selectedImages.length === 0) return;
  const { jsPDF } = window.jspdf;
  const pageWidth = 595; // Ancho de página A4 en puntos
  const pageHeight = 842; // Altura de página A4 en puntos
  const canvasResolution = 3; // Aumentar resolución del lienzo
  let pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [pageWidth, pageHeight],
  });

  for (let i = 0; i < selectedImages.length; i++) {
    const file = selectedImages[i];
    const imgData = await readImageAsDataURL(file);
    const img = await loadImage(imgData);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = pageWidth * canvasResolution;
    canvas.height = pageHeight * canvasResolution;
    ctx.scale(canvasResolution, canvasResolution); // Escalar para mayor resolución
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(pageWidth / img.width, pageHeight / img.height);
    const x = (pageWidth - img.width * scale) / 2;
    const y = (pageHeight - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    const finalImgData = canvas.toDataURL('image/jpeg', 0.95); // Alta calidad
    if (i > 0) {
      pdf.addPage([pageWidth, pageHeight]);
    }
    pdf.addImage(finalImgData, 'JPEG', 0, 0, pageWidth, pageHeight);
  }
  pdf.save(selectedImages[0].name.replace(/\.[^/.]+$/, ".pdf"));
  resetUnifiedPDFState(); // Reiniciar el estado
});

generatePdfBNButton.addEventListener('click', async () => {
  if (selectedImages.length === 0) return;
  const { jsPDF } = window.jspdf;
  const pageWidth = 595; // Ancho de página A4 en puntos
  const pageHeight = 842; // Altura de página A4 en puntos
  const canvasResolution = 3; // Aumentar resolución del lienzo
  let pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [pageWidth, pageHeight],
  });

  for (let i = 0; i < selectedImages.length; i++) {
    const file = selectedImages[i];
    const imgData = await readImageAsDataURL(file);
    const img = await loadImage(imgData);
    const canvas = document.createElement('canvas');
    canvas.width = pageWidth * canvasResolution;
    canvas.height = pageHeight * canvasResolution;
    const ctx = canvas.getContext('2d');
    ctx.scale(canvasResolution, canvasResolution); // Escalar para mayor resolución
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(pageWidth / img.width, pageHeight / img.height);
    const x = (pageWidth - img.width * scale) / 2;
    const y = (pageHeight - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    // Aplicar filtro escáner
    applyScanFilterToCanvas(canvas, canvas.width, canvas.height);

    const filteredImgData = canvas.toDataURL('image/jpeg', 0.95); // Alta calidad
    if (i > 0) {
      pdf.addPage([pageWidth, pageHeight]);
    }
    pdf.addImage(filteredImgData, 'JPEG', 0, 0, pageWidth, pageHeight);
  }
  pdf.save(selectedImages[0].name.replace(/\.[^/.]+$/, ".pdf"));
  resetUnifiedPDFState(); // Reiniciar el estado
});

cancelPdfButton.addEventListener('click', () => {
  resetUnifiedPDFState(); // Reiniciar el estado
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

/* ====================================================
  SECCIÓN: Ordenar imágenes
==================================================== */
const sortImagesButton = document.getElementById('sortImages');
const sortModal = document.getElementById('sortModal');
const sortableImages = document.getElementById('sortableImages');
const applySortButton = document.getElementById('applySort');
const cancelSortButton = document.getElementById('cancelSort');
const addMoreImagesButton = document.createElement('div');
addMoreImagesButton.id = 'addMoreImages';
addMoreImagesButton.textContent = 'Agregar más imágenes';
sortableImages.appendChild(addMoreImagesButton);

const previewModal = document.createElement('div');
const previewImage = document.createElement('img');

previewModal.classList.add('modal');
previewModal.style.display = 'none';
previewModal.appendChild(previewImage);
document.body.appendChild(previewModal);

previewModal.addEventListener('click', () => {
  previewModal.style.display = 'none';
});

sortImagesButton.addEventListener('click', () => {
  updateSortableImagesPreview(); // Actualizar la vista previa
  sortModal.style.display = 'block';
  new Sortable(sortableImages, {
    animation: 150,
    ghostClass: 'sortable-ghost',
  });
});

applySortButton.addEventListener('click', () => {
  const sortedImages = [];
  sortableImages.querySelectorAll('img').forEach(img => {
    sortedImages.push(selectedImages[img.dataset.index]);
  });
  selectedImages = sortedImages;
  sortModal.style.display = 'none';
});

cancelSortButton.addEventListener('click', () => {
  sortModal.style.display = 'none';
});

addMoreImagesButton.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png, image/jpeg';
  input.multiple = true;
  input.click();
  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      processImages(Array.from(input.files));
      sortImagesButton.click(); // Reabrir el modal para actualizar la lista de imágenes
    }
  });
});

addMoreImagesButton.addEventListener('dragover', (e) => {
  e.preventDefault();
  addMoreImagesButton.classList.add('dragover');
});

addMoreImagesButton.addEventListener('dragleave', () => {
  addMoreImagesButton.classList.remove('dragover');
});

addMoreImagesButton.addEventListener('drop', (e) => {
  e.preventDefault();
  addMoreImagesButton.classList.remove('dragover');
  const files = getFilesFromDataTransfer(e);
  processImages(files);
  sortImagesButton.click(); // Reabrir el modal para actualizar la lista de imágenes
});
