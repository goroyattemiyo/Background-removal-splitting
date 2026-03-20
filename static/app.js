(function(){
  var dropZone=document.getElementById("drop-zone");
  var fileInput=document.getElementById("file-input");
  var uploadWrap=document.getElementById("upload-preview-wrap");
  var uploadCanvas=document.getElementById("upload-canvas");
  var ctx=uploadCanvas.getContext("2d",{willReadFrequently:true});
  var pickerCanvas=document.getElementById("picker-canvas");
  var stepColor=document.getElementById("step-color");
  var colorSwatch=document.getElementById("color-swatch");
  var colorLabel=document.getElementById("color-label");
  var stepSettings=document.getElementById("step-settings");
  var rowsInput=document.getElementById("rows");
  var colsInput=document.getElementById("cols");
  var toleranceInput=document.getElementById("tolerance");
  var tolValSpan=document.getElementById("tol-val");
  var edgeSoftInput=document.getElementById("edge-softness");
  var softValSpan=document.getElementById("soft-val");
  var lineFormatCb=document.getElementById("line-format");
  var btnProcess=document.getElementById("btn-process");
  var progressWrap=document.getElementById("progress-bar-wrap");
  var progressFill=document.getElementById("progress-fill");
  var progressText=document.getElementById("progress-text");
  var stepResults=document.getElementById("step-results");
  var resultsGrid=document.getElementById("results-grid");
  var resultCount=document.getElementById("result-count");
  var btnDownload=document.getElementById("btn-download-zip");
  var btnRemoveBg=document.getElementById("btn-remove-bg");

  var sessionId=null;
  var sourceImg=null;
  var pickedR=null,pickedG=null,pickedB=null;
  var colorPicked=false;
  var processing=false;

  ["dragenter","dragover"].forEach(function(e){
    dropZone.addEventListener(e,function(ev){ev.preventDefault();dropZone.classList.add("drag-over");});
  });
  ["dragleave","drop"].forEach(function(e){
    dropZone.addEventListener(e,function(ev){ev.preventDefault();dropZone.classList.remove("drag-over");});
  });
  dropZone.addEventListener("drop",function(ev){
    if(ev.dataTransfer.files.length)handleFile(ev.dataTransfer.files[0]);
  });
  dropZone.addEventListener("click",function(ev){if(ev.target===dropZone)fileInput.click();});
  fileInput.addEventListener("change",function(){if(fileInput.files.length)handleFile(fileInput.files[0]);});

  function handleFile(file){
    var fd=new FormData();fd.append("image",file);
    fetch("/upload",{method:"POST",body:fd}).then(function(r){return r.json();}).then(function(d){
      if(d.error){alert(d.error);return;}
      sessionId=d.session_id;
      colorPicked=false;pickedR=null;pickedG=null;pickedB=null;
      colorSwatch.style.background="#333";colorLabel.textContent="\u672a\u9078\u629e";
      var url=URL.createObjectURL(file);
      sourceImg=new Image();
      sourceImg.onload=function(){drawPreview();};
      sourceImg.src=url;
      uploadWrap.classList.remove("hidden");
      stepSettings.classList.remove("hidden");
      stepColor.classList.add("hidden");
      stepResults.classList.add("hidden");
      progressWrap.classList.add("hidden");
    });
  }

  function drawPreview(){
    if(!sourceImg)return;
    var W=uploadCanvas.parentElement.clientWidth;
    var sc=W/sourceImg.width;
    uploadCanvas.width=W;uploadCanvas.height=sourceImg.height*sc;
    ctx.drawImage(sourceImg,0,0,uploadCanvas.width,uploadCanvas.height);
    var rows=parseInt(rowsInput.value)||1;var cols=parseInt(colsInput.value)||1;
    ctx.strokeStyle="rgba(124,92,252,0.7)";ctx.lineWidth=1.5;
    var cw=uploadCanvas.width/cols;var ch=uploadCanvas.height/rows;
    for(var c=1;c<cols;c++){ctx.beginPath();ctx.moveTo(c*cw,0);ctx.lineTo(c*cw,uploadCanvas.height);ctx.stroke();}
    for(var r=1;r<rows;r++){ctx.beginPath();ctx.moveTo(0,r*ch);ctx.lineTo(uploadCanvas.width,r*ch);ctx.stroke();}
  }

  function drawPickerPreview(){
    if(!sourceImg||!pickerCanvas)return;
    var pickerCtx=pickerCanvas.getContext("2d",{willReadFrequently:true});
    var W=pickerCanvas.parentElement.clientWidth;
    var sc=W/sourceImg.width;
    pickerCanvas.width=W;pickerCanvas.height=sourceImg.height*sc;
    pickerCtx.drawImage(sourceImg,0,0,pickerCanvas.width,pickerCanvas.height);
  }

  rowsInput.addEventListener("input",drawPreview);
  colsInput.addEventListener("input",drawPreview);
  toleranceInput.addEventListener("input",function(){tolValSpan.textContent=toleranceInput.value;});
  edgeSoftInput.addEventListener("input",function(){softValSpan.textContent=edgeSoftInput.value;});

  // --- Step 2: 分割のみ ---
  btnProcess.addEventListener("click",function(){
    if(!sessionId||processing)return;
    processing=true;btnProcess.disabled=true;btnProcess.textContent="\u5206\u5272\u4e2d\u2026";
    progressWrap.classList.remove("hidden");progressFill.style.width="20%";
    progressText.textContent="\u30b0\u30ea\u30c3\u30c9\u5206\u5272\u4e2d\u2026";
    fetch("/process",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({session_id:sessionId,rows:parseInt(rowsInput.value),cols:parseInt(colsInput.value),
        remove_bg:false,line_format:false,use_ai_upscale:false,
        bg_r:0,bg_g:0,bg_b:0,tolerance:10,edge_softness:2})
    }).then(function(r){return r.json();}).then(function(d){
      if(d.error){alert(d.error);return;}
      progressFill.style.width="100%";progressText.textContent="\u5206\u5272\u5b8c\u4e86\uff01";
      showResults(d);
      stepColor.classList.remove("hidden");
      drawPickerPreview();
      stepResults.classList.remove("hidden");
      stepResults.scrollIntoView({behavior:"smooth"});
    }).catch(function(err){alert("Error: "+err.message);progressText.textContent="\u30a8\u30e9\u30fc";
    }).finally(function(){processing=false;btnProcess.disabled=false;btnProcess.textContent="\u5206\u5272\u3092\u5b9f\u884c";});
  });

  // --- Step 4: スポイト ---
  if(pickerCanvas){
    pickerCanvas.addEventListener("click",function(ev){
      if(!sourceImg||processing)return;
      var pickerCtx=pickerCanvas.getContext("2d",{willReadFrequently:true});
      var W=pickerCanvas.width;var H=pickerCanvas.height;
      pickerCtx.drawImage(sourceImg,0,0,W,H);
      var rect=pickerCanvas.getBoundingClientRect();
      var cx=ev.clientX-rect.left;var cy=ev.clientY-rect.top;
      var pixel=pickerCtx.getImageData(Math.round(cx),Math.round(cy),1,1).data;
      pickedR=pixel[0];pickedG=pixel[1];pickedB=pixel[2];
      colorPicked=true;
      colorSwatch.style.background="rgb("+pickedR+","+pickedG+","+pickedB+")";
      colorLabel.textContent="RGB("+pickedR+", "+pickedG+", "+pickedB+")";
      btnRemoveBg.disabled=false;
    });
  }

  // --- Step 4: 背景除去 ---
  btnRemoveBg.addEventListener("click",function(){
    if(!sessionId||!colorPicked||processing)return;
    processing=true;btnRemoveBg.disabled=true;btnRemoveBg.textContent="\u80cc\u666f\u9664\u53bb\u4e2d\u2026";
    progressWrap.classList.remove("hidden");progressFill.style.width="20%";
    progressText.textContent="AI\u80cc\u666f\u9664\u53bb\u4e2d\u2026";
    fetch("/process",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({session_id:sessionId,rows:parseInt(rowsInput.value),cols:parseInt(colsInput.value),
        remove_bg:true,bg_r:pickedR,bg_g:pickedG,bg_b:pickedB,
        tolerance:parseInt(toleranceInput.value),edge_softness:parseInt(edgeSoftInput.value),
        line_format:lineFormatCb.checked,use_ai_upscale:false})
    }).then(function(r){return r.json();}).then(function(d){
      if(d.error){alert(d.error);return;}
      progressFill.style.width="100%";progressText.textContent="\u80cc\u666f\u9664\u53bb\u5b8c\u4e86\uff01";
      showResults(d);
    }).catch(function(err){alert("Error: "+err.message);progressText.textContent="\u30a8\u30e9\u30fc";
    }).finally(function(){processing=false;btnRemoveBg.disabled=false;btnRemoveBg.textContent="\u80cc\u666f\u9664\u53bb\u3092\u5b9f\u884c";});
  });

  function showResults(d){
    resultCount.textContent=d.count+" \u500b\u751f\u6210";
    resultsGrid.innerHTML="";var ts=Date.now();
    d.results.forEach(function(fname,i){
      var cell=document.createElement("div");cell.className="result-cell";
      var img=document.createElement("img");img.src="/preview/"+sessionId+"/"+fname+"?t="+ts;img.loading="lazy";
      var lb=document.createElement("div");lb.className="label";lb.textContent=(i+1);
      cell.appendChild(img);cell.appendChild(lb);resultsGrid.appendChild(cell);
    });
    stepResults.classList.remove("hidden");
  }

  btnDownload.addEventListener("click",function(){
    if(!sessionId)return;
    window.location.href="/download/"+sessionId;
  });
})();
