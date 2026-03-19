(function(){
  var dropZone=document.getElementById("drop-zone");
  var fileInput=document.getElementById("file-input");
  var uploadWrap=document.getElementById("upload-preview-wrap");
  var uploadCanvas=document.getElementById("upload-canvas");
  var ctx=uploadCanvas.getContext("2d",{willReadFrequently:true});
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
  var aiUpscaleCb=document.getElementById("ai-upscale");
  var btnProcess=document.getElementById("btn-process");
  var progressWrap=document.getElementById("progress-bar-wrap");
  var progressFill=document.getElementById("progress-fill");
  var progressText=document.getElementById("progress-text");
  var stepResults=document.getElementById("step-results");
  var resultsGrid=document.getElementById("results-grid");
  var resultCount=document.getElementById("result-count");
  var btnDownload=document.getElementById("btn-download-zip");

  var sessionId=null;
  var sourceImg=null;
  var pickedR=255,pickedG=0,pickedB=255;
  var colorPicked=false;
  var processing=false;

  ["dragenter","dragover"].forEach(function(e){
    dropZone.addEventListener(e,function(ev){
      ev.preventDefault();dropZone.classList.add("drag-over");
    });
  });
  ["dragleave","drop"].forEach(function(e){
    dropZone.addEventListener(e,function(ev){
      ev.preventDefault();dropZone.classList.remove("drag-over");
    });
  });
  dropZone.addEventListener("drop",function(ev){
    if(ev.dataTransfer.files.length)handleFile(ev.dataTransfer.files[0]);
  });
  dropZone.addEventListener("click",function(ev){if(ev.target===dropZone)fileInput.click();});
  fileInput.addEventListener("change",function(){
    if(fileInput.files.length)handleFile(fileInput.files[0]);
  });

  function handleFile(file){
    var fd=new FormData();
    fd.append("image",file);
    fetch("/upload",{method:"POST",body:fd})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.error){alert(d.error);return;}
        sessionId=d.session_id;
        colorPicked=false;
        colorSwatch.style.background="#333";
        colorLabel.textContent="未選択";
        var url=URL.createObjectURL(file);
        sourceImg=new Image();
        sourceImg.onload=function(){drawPreview();};
        sourceImg.src=url;
        uploadWrap.classList.remove("hidden");
        stepColor.classList.remove("hidden");
        stepSettings.classList.add("hidden");
        stepResults.classList.add("hidden");
        progressWrap.classList.add("hidden");
      });
  }

  function drawPreview(){
    if(!sourceImg)return;
    var W=uploadCanvas.parentElement.clientWidth;
    var sc=W/sourceImg.width;
    uploadCanvas.width=W;
    uploadCanvas.height=sourceImg.height*sc;
    ctx.drawImage(sourceImg,0,0,uploadCanvas.width,uploadCanvas.height);
    if(colorPicked){
      var rows=parseInt(rowsInput.value)||1;
      var cols=parseInt(colsInput.value)||1;
      ctx.strokeStyle="rgba(124,92,252,0.7)";
      ctx.lineWidth=1.5;
      var cw=uploadCanvas.width/cols;
      var ch=uploadCanvas.height/rows;
      for(var c=1;c<cols;c++){
        ctx.beginPath();ctx.moveTo(c*cw,0);
        ctx.lineTo(c*cw,uploadCanvas.height);ctx.stroke();
      }
      for(var r=1;r<rows;r++){
        ctx.beginPath();ctx.moveTo(0,r*ch);
        ctx.lineTo(uploadCanvas.width,r*ch);ctx.stroke();
      }
    }
  }
  rowsInput.addEventListener("input",drawPreview);
  colsInput.addEventListener("input",drawPreview);
  toleranceInput.addEventListener("input",function(){tolValSpan.textContent=toleranceInput.value;});
  edgeSoftInput.addEventListener("input",function(){softValSpan.textContent=edgeSoftInput.value;});

  // --- Eyedropper ---
  uploadCanvas.addEventListener("click",function(ev){
    if(!sourceImg||processing)return;
    // redraw clean image first (no grid lines) to read correct pixel
    var W=uploadCanvas.width;
    var H=uploadCanvas.height;
    ctx.drawImage(sourceImg,0,0,W,H);
    var rect=uploadCanvas.getBoundingClientRect();
    var cx=ev.clientX-rect.left;
    var cy=ev.clientY-rect.top;
    var pixel=ctx.getImageData(Math.round(cx),Math.round(cy),1,1).data;
    pickedR=pixel[0];pickedG=pixel[1];pickedB=pixel[2];
    colorPicked=true;
    colorSwatch.style.background="rgb("+pickedR+","+pickedG+","+pickedB+")";
    colorLabel.textContent="RGB("+pickedR+", "+pickedG+", "+pickedB+")";
    stepSettings.classList.remove("hidden");
    drawPreview();
  });

  // --- Process (repeatable) ---
  btnProcess.addEventListener("click",function(){
    if(!sessionId||!colorPicked||processing)return;
    processing=true;
    btnProcess.disabled=true;
    btnProcess.textContent="処理中…";
    progressWrap.classList.remove("hidden");
    progressFill.style.width="20%";
    progressText.textContent="グリッド分割 & 背景除去中…";
    var p={
      session_id:sessionId,
      rows:parseInt(rowsInput.value),
      cols:parseInt(colsInput.value),
      tolerance:parseInt(toleranceInput.value),
      remove_bg:false,edge_softness:parseInt(edgeSoftInput.value),
      line_format:lineFormatCb.checked,
      use_ai_upscale:aiUpscaleCb.checked,
      bg_r:pickedR,bg_g:pickedG,bg_b:pickedB
    };
    fetch("/process",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(p)
    })
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.error){alert(d.error);return;}
      progressFill.style.width="100%";
      progressText.textContent="完了！";
      resultCount.textContent=d.count+" 個生成";
      resultsGrid.innerHTML="";
      var ts=Date.now();
      d.results.forEach(function(fname,i){
        var cell=document.createElement("div");
        cell.className="result-cell";
        var img=document.createElement("img");
        img.src="/preview/"+sessionId+"/"+fname+"?t="+ts;
        img.loading="lazy";
        var lb=document.createElement("div");
        lb.className="label";
        lb.textContent=(i+1);
        cell.appendChild(img);
        cell.appendChild(lb);
        resultsGrid.appendChild(cell);
      });
      stepResults.classList.remove("hidden");
      stepResults.scrollIntoView({behavior:"smooth"});
    })
    .catch(function(err){
      alert("Error: "+err.message);
      progressText.textContent="エラー";
    })
    .finally(function(){
      processing=false;
      btnProcess.disabled=false;
      btnProcess.textContent="処理を開始";
    });
  });

  btnDownload.addEventListener("click",function(){
    if(!sessionId)return;
    window.location.href="/download/"+sessionId;
  });
})();

    // --- 背景除去ボタン追加 ---
    var existingRmBtn = document.getElementById("removeBgBtn");
    if(existingRmBtn) existingRmBtn.remove();
    var rmBtn = document.createElement("button");
    rmBtn.id = "removeBgBtn";
    rmBtn.textContent = "背景除去を実行";
    rmBtn.style.cssText = "margin:16px 8px;padding:12px 32px;background:linear-gradient(135deg,#e44d26,#f16529);color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;";
    rmBtn.addEventListener("click", function(){
      rmBtn.disabled=true;rmBtn.textContent="背景除去中...";
      fetch("/process",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({session_id:window._sessionId,rows:parseInt(document.getElementById("rows").value),cols:parseInt(document.getElementById("cols").value),bg_r:window._pickedColor[0],bg_g:window._pickedColor[1],bg_b:window._pickedColor[2],remove_bg:true,tolerance:parseInt(document.getElementById("tolerance").value||"10"),edge_softness:parseInt(document.getElementById("edge-softness").value||"2"),line_format:document.getElementById("line-format").checked})
      }).then(r=>r.json()).then(function(d){
        rmBtn.textContent="背景除去を実行";rmBtn.disabled=false;
        var grid=document.getElementById("results-grid");grid.innerHTML="";
        var t=Date.now();
        d.results.forEach(function(f){var img=document.createElement("img");img.src="/preview/"+window._sessionId+"/"+f+"?t="+t;img.style.cssText="max-width:120px;max-height:120px;margin:4px;border-radius:4px;background:repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50%/16px 16px;";grid.appendChild(img);});
      });
    });
    var resultsSection = document.getElementById("results") || document.querySelector(".results");
    if(resultsSection){var dlBtn=resultsSection.querySelector("a[download],button");if(dlBtn)dlBtn.parentNode.insertBefore(rmBtn,dlBtn);else resultsSection.appendChild(rmBtn);}
