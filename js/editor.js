    /* ====================================================
      Modal de edición (se usará para aplicar recorte y filtro)
    ==================================================== */
    let cropper = null;
    let editedImageData = null; // Se almacenará la imagen editada

    function openEditor(dataURL) {
      const editorModal = document.getElementById('editorModal');
      const editorImage = document.getElementById('editorImage');
      editorImage.src = dataURL;
      if(cropper) { cropper.destroy(); }
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
      if(cropper) { cropper.destroy(); cropper = null; }
    }

    document.getElementById('cancelEdit').addEventListener('click', closeEditor);

    // Al pulsar "Descargar con filtro escáner" se toma el recorte, se aplica el filtro y se descarga
    document.getElementById('applyEdit').addEventListener('click', () => {
      if (!cropper) return;
      const croppedCanvas = cropper.getCroppedCanvas();
      // Aplica el filtro de escáner al canvas recortado
      applyScanFilterToCanvas(croppedCanvas, croppedCanvas.width, croppedCanvas.height);
      const editedData = croppedCanvas.toDataURL('image/jpeg', 0.85);
      // Descarga según el tipo de archivo editado
      if(editFileType === "image") {
        const link = document.createElement('a');
        link.href = editedData;
        link.download = editFileName;
        link.click();
      } else if(editFileType === "pdf") {
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
      Sección: Extraer imágenes de PDF (ya existente)
    ==================================================== */
    const dropZonePdf = document.getElementById('dropZone');
    const pdfCanvas = document.getElementById('pdfCanvas');
    const ctx = pdfCanvas.getContext('2d');
    const downloadBtn = document.getElementById('downloadAllImages');
    const downloadBtnBN = document.getElementById('downloadAllImagesBN');
    const cancelExtractButton = document.getElementById('cancelExtract');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    section1.addEventListener('dragover', (e) => { e.preventDefault(); section1.classList.add('dragover'); });
    section1.addEventListener('dragleave', () => { section1.classList.remove('dragover'); });
    section1.addEventListener('drop', (e) => {e.preventDefault();section1.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if(files.length > 0 && files[0].type === 'application/pdf') {
        const file = files[0];
        dropZonePdf.textContent = `Archivo cargado: ${file.name}`;
        cancelExtractButton.style.display = 'inline-block';
        extractImagesFromPdf(file);
      // } else { 
      //   alert('Por favor, arrastra un archivo válido (PDF).'); 
      // }
    }});
    dropZonePdf.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.click();
      input.addEventListener('change', () => {
        const file = input.files[0];
        if(file && file.type === 'application/pdf') {
          dropZonePdf.textContent = `Archivo cargado: ${file.name}`;
          cancelExtractButton.style.display = 'inline-block';
          extractImagesFromPdf(file);
        // } else { 
        //   alert('Por favor, selecciona un archivo válido (PDF).'); 
        // }
    }});
    });

    async function extractImagesFromPdf(pdfFile) {
      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';
      const fileReader = new FileReader();
      fileReader.onload = async function(e) {
        const pdfData = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        const baseName = pdfFile.name.replace(/\.[^/.]+$/, "");//nombre de la extraccion de imagenes de un pdf
        const extractedImages = [];
        for(let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          pdfCanvas.width = viewport.width;
          pdfCanvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          const imageData = pdfCanvas.toDataURL('image/jpeg');
          extractedImages.push({ data: imageData, filename: `${baseName}-pagina-${i}.jpeg` });//nombre de la extraccion de imagenes de un pdf para la descarga
          progressBar.style.width = ((i / pdf.numPages)*100) + '%';
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
          link.download = `${baseName}.zip`; // Usa el mismo nombre del PDF original
          link.click();
          downloadBtn.style.display = 'none';
          downloadBtnBN.style.display = 'none';
          cancelExtractButton.style.display = 'none';
          dropZonePdf.textContent = 'Arrastra y suelta un archivo PDF aquí o haz clic para seleccionarlo';
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
          link.download = `${baseName}.zip`; // Usa el mismo nombre con "_scan"
          link.click();
          downloadBtn.style.display = 'none';
          downloadBtnBN.style.display = 'none';
          cancelExtractButton.style.display = 'none';
          dropZonePdf.textContent = 'Arrastra y suelta un archivo PDF aquí o haz clic para seleccionarlo';
        };
        // alert('Las imágenes han sido extraídas. Puedes descargarlas (color o con filtro escáner), editar o cancelar.');
      };
      fileReader.readAsArrayBuffer(pdfFile);
    }

    cancelExtractButton.addEventListener('click', () => {
      dropZonePdf.textContent = 'Arrastra y suelta un archivo PDF aquí o haz clic para seleccionarlo';
      downloadBtn.style.display = 'none';
      downloadBtnBN.style.display = 'none';
      cancelExtractButton.style.display = 'none';
      progressContainer.style.display = 'none';
    });

    function applyScanFilterToCanvas(canvas, width, height) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const contrast = 2.6;
      const brightness = 10;
      for(let i = 0; i < data.length; i += 4) {
        let gray = 0.3 * data[i] + 0.59 * data[i+1] + 0.11 * data[i+2];
        gray = contrast * (gray - 128) + 128 + brightness;
        gray = Math.max(0, Math.min(255, gray));
        data[i] = data[i+1] = data[i+2] = gray;
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
          for(let i = 0; i < data.length; i += 4) {
            let gray = 0.3 * data[i] + 0.59 * data[i+1] + 0.11 * data[i+2];
            gray = contrast * (gray - 128) + 128 + brightness;
            gray = Math.max(0, Math.min(255, gray));
            data[i] = data[i+1] = data[i+2] = gray;
          }
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = dataURL;
      });
    }

 // =====================================
// FUNCIONES AUXILIARES PARA CARGAR IMÁGENES
// =====================================

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

// =====================================
// Sección: Convertir imágenes a PDF (ya existente)
// =====================================

    const dropZoneConv = document.getElementById('dropZone');
    const generatePdfButton = document.getElementById('generatePdf');
    const generatePdfBNButton = document.getElementById('generatePdfBN');
    const cancelPdfButton = document.getElementById('cancelPdf');
    let selectedImages = [];//nombre de las imagenes seleccionadas en la de imagenes a PDF

    generatePdfButton.style.display = 'none';
    generatePdfBNButton.style.display = 'none';
    cancelPdfButton.style.display = 'none';

    section1.addEventListener('dragover', (e) => { e.preventDefault(); section1.classList.add('dragover'); });
    section1.addEventListener('dragleave', () => { section1.classList.remove('dragover'); });
    section1.addEventListener('drop', (e) => {e.preventDefault();section1.classList.remove('dragover');processImages(e.dataTransfer.files); });
    dropZoneConv.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg';
      input.multiple = true;
      input.click();
      input.addEventListener('change', () => processImages(input.files));
    });

    function processImages(files) {
      selectedImages = Array.from(files).filter(file =>
        file.type === 'image/png' || file.type === 'image/jpeg'
      );
      if (selectedImages.length > 0) {
        dropZoneConv.textContent = `${selectedImages.length} imágenes cargadas`;
        // Muestra los botones al cargar imágenes
        generatePdfButton.style.display = 'inline-block';
        generatePdfBNButton.style.display = 'inline-block';
        cancelPdfButton.style.display = 'inline-block';
      } else {
        // alert('Por favor, selecciona imágenes válidas (PNG o JPEG).');
      }
    }
    

    generatePdfButton.addEventListener('click', async () => {
      if (selectedImages.length === 0) return;
      const { jsPDF } = window.jspdf;
      let pdf = null;
    
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
        const filteredImgData = canvas.toDataURL('image/jpeg', 0.85);
    
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
    });
    

    cancelPdfButton.addEventListener('click', () => {
      selectedImages = [];
      dropZoneConv.textContent = 'Arrastra y suelta imágenes aquí o haz clic para seleccionarlas';
      generatePdfButton.style.display = 'none';
      generatePdfBNButton.style.display = 'none';
      cancelPdfButton.style.display = 'none';
    });

    /* ====================================================
      SECCIÓN: Editar imágenes o documentos sin conversión
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
    if(!file) return;
    editFileName = file.name; // Guarda el nombre original del archivo
    editDropZone.textContent = `Archivo cargado: ${file.name}`;//nombre de las imagenes en la funcion de editar
    editPreviewContainer.style.display = 'none';
    cancelEditSectionButton.style.display = 'inline-block';
    openEditorButton.style.display = 'inline-block';
    downloadEditedButton.style.display = 'inline-block';
    if(file.type.startsWith('image/')) {
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
    } else if(file.type === 'application/pdf') {
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
      if(editOriginalData) { openEditor(editOriginalData);ß }
    });

    downloadEditedButton.addEventListener('click', () => {
      if(editFileType === "image") {
        const { jsPDF } = window.jspdf;
        // Abrir editor para aplicar recorte y filtro antes de descargar
        openEditor(editOriginalData);
        // La descarga se realizará al pulsar "Descargar con filtro escáner" en el modal
      } else if(editFileType === "pdf") {
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
  
  }//.