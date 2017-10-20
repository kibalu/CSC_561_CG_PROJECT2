/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
var INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
var INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/ellipsoids.json"; // ellipsoids file loc
var INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog2/lights.json"; // lights file loc

var selectTri = -1;
var selectEll = -1;
var Eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var at = new vec3.fromValues(0,0,1);
var viewUp = new vec4.fromValues(0,1,0);
var rotateposition = vec3.fromValues(0.5,0.5,0.5);
var neweye = new vec3.fromValues(0,0,0);
/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples

var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vtxBufferSize = 0; // the number of vertices in the vertex buffer

var vertexPositionAttrib; // where to put position for vertex 
var vertexColorAttrib; // where to put position for vertex shader

var coordArray = []; // 1D array of vertex coords for WebGL
var indexArray = []; // 1D array of vertex indices for WebGL
var lights = getJSONFile(INPUT_LIGHTS_URL,"lights");
var ecpnum;
var curecp = -1;
var trannum;
var curtran = -1;
var Achange = 0;
var Dchange = 0;
var Schange = 0;
var Nchange = 0;
var blinn = true;
var viewmodel = mat4.create();
var viewy = 0;
var viewx = 0;
var viewz = 0;

function transform(vtxs,eye){
    var vtx = [vtxs[0], vtxs[1], vtxs[2]];
    var matview = mat4.create();
    var center = vec3.create();
    var matPers = mat4.create();
    center = vec3.add(center,eye,at);
    //center = rotateposition;
    matview = mat4.lookAt(matview, eye, center, viewUp);
    matPers = mat4.perspective(matPers, Math.PI/2., 1, 0.1, 10);
    vec3.transformMat4(vtx, vtx, matview);
    vec3.transformMat4(vtx, vtx, matPers);
    return vtx;
}


function lighting(eye,light,normal,vertex,ambient,diffuse,specular,n,b){
    var color = [
                    ambient[0]*light[0].ambient[0],
                    ambient[1]*light[0].ambient[1],
                    ambient[2]*light[0].ambient[2]
                ];
    for(var lightIndex =0; lightIndex<light.length;lightIndex++){
        lightSource = light[lightIndex];
        var ldiffuse = lightSource.diffuse;
        var lspecular = lightSource.specular;

        var lightPos = vec3.fromValues(lightSource.x,lightSource.y,lightSource.z);

        var lvec = vec3.create();
        vec3.subtract(lvec,lightPos,vertex);
        vec3.normalize(lvec,lvec);

        var evec = vec3.create();
        vec3.subtract(evec,eye,vertex);
        vec3.normalize(evec,evec);

        var hvec = vec3.create();
        vec3.add(hvec,evec,lvec);
        vec3.normalize(hvec,hvec);
        var nh = vec3.create();
        var nl = Math.max(vec3.dot(normal,lvec),0);

        var ref = vec3.create();
        vec3.scale(ref,normal,2*vec3.dot(lvec,normal));
        vec3.subtract(ref,ref,lvec);

        if(b) nh = Math.max(vec3.dot(normal,hvec),0);
        else nh = Math.max(vec3.dot(evec,ref),0)

        color[0] += diffuse[0]*ldiffuse[0]*nl+specular[0]*lspecular[0]*Math.pow(nh,n);
        color[1] += diffuse[1]*ldiffuse[1]*nl+specular[1]*lspecular[1]*Math.pow(nh,n);
        color[2] += diffuse[2]*ldiffuse[2]*nl+specular[2]*lspecular[2]*Math.pow(nh,n);
    }

    return color;
}

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get json file

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles(lights,eye) {
    // console.log("triangles");
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    trianglenum = inputTriangles.length;
    // var inputTriangles = triangleJson();
    // console.log(inputTriangles[0].vertices[0][0].toString());
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        var clrToAdd = vec3.create();
        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {

            // console.log("set:"+whichSet);
            vec3.set(indexOffset,vtxBufferSize,vtxBufferSize,vtxBufferSize); // update vertex offset
            
            // console.log("offset:"+indexOffset);
            var ambient = inputTriangles[whichSet].material.ambient;
            var diffuse = inputTriangles[whichSet].material.diffuse;
            var specular = inputTriangles[whichSet].material.specular;
            var n = inputTriangles[whichSet].material.n;
            var center =[0,0,0];
            trannum = inputTriangles.length;
            verLength = inputTriangles[whichSet].vertices.length;
            var curblinn = true;
            var cureye = new vec3.fromValues(eye[0],eye[1],eye[2]);
            var curview = mat4.create();
            mat4.copy(curview, viewmodel)
            if(curtran == whichSet){
                for(var i = 0; i < ambient.length; i++){
                    ambient[i] = (ambient[i] + Achange)%1;
                    //console.log(ka[i]);
                    diffuse[i] = (diffuse[i] + Dchange)%1;
                    specular[i] = (specular[i] + Schange)%1;
                }
                mat4.rotateY(curview,curview, viewy * (Math.PI));
                mat4.rotateX(curview,curview, viewx * (Math.PI));
                mat4.rotateZ(curview,curview, viewz * (Math.PI));
                vec3.add(cureye,cureye,neweye);
                n = n + Nchange;
                n = n % 21;
                curblinn = blinn;
            }
            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<verLength; whichSetVert++) {
                var coord = inputTriangles[whichSet].vertices[whichSetVert];
                center[0] += coord[0]/verLength;
                center[1] += coord[1]/verLength;
                center[2] += coord[2]/verLength;
            }
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                
                var newver =  inputTriangles[whichSet].vertices[whichSetVert];
                if(curtran == whichSet){
                    vec3.subtract(newver,newver,center);
                    vec3.scaleAndAdd(newver,center,newver,1.2);
                    vec3.subtract (newver, newver, center);
                    vec3.transformMat4(newver, newver, curview);
                    vec3.add(newver, newver, center);
                }
                //vtxToAdd = transform(inputTriangles[whichSet].vertices[whichSetVert],eye);
                vec3.subtract (newver, newver, rotateposition);
                vec3.transformMat4(newver, newver, viewmodel);
                vec3.add(newver, newver, rotateposition);
                vtxToAdd = transform(newver,cureye);
                var normal = inputTriangles[whichSet].normals[whichSetVert];

                for(vtxIndex=0; vtxIndex<vtxToAdd.length; vtxIndex++){
                    coordArray.push(vtxToAdd[vtxIndex]);
                }
                //var color = lighting(eye,lights,normal,inputTriangles[whichSet].vertices[whichSetVert] ,ka,kd,ks,n,blinn);
                var color = lighting(cureye,lights,normal,newver ,ambient,diffuse,specular,n,curblinn);
                coordArray.push(color[0],color[1],color[2]);
                vtxBufferSize +=1;
                // console.log("vtxBufferSize"+vtxBufferSize);

            } // end for vertices in set
            
            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd,indexOffset,inputTriangles[whichSet].triangles[whichSetTri]);
                for(triIndex=0; triIndex<vtxToAdd.length; triIndex++){
                    indexArray.push(triToAdd[triIndex]);
                    triBufferSize += 1;
                   
                }
            } // end for triangles in set
        } 
    } // end if triangles found
} // end load triangles

function loadEllipes(lights,eye) {
    var inputEcllipes = getJSONFile(INPUT_SPHERES_URL,"ellipsoids");
    if (inputEcllipes != String.null) { 
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        var clrToAdd = vec3.create();

        var latInt = 100;
        var lonInt = 100;
        ecpnum = inputEcllipes.length
        for (var whichSet=0; whichSet<inputEcllipes.length; whichSet++) {
            var ambient = inputEcllipes[whichSet].ambient;
            var diffuse = inputEcllipes[whichSet].diffuse;
            var specular = inputEcllipes[whichSet].specular;
            var n = inputEcllipes[whichSet].n;
            // var la = lights.ambient;
            // var ldiffuse = lights.diffuse;
            // var ls = lights.specular;
            var rc = 1;
            var curblinn = true;
            var cureye = new vec3.fromValues(eye[0],eye[1],eye[2]);
            var curview = mat4.create();
            mat4.copy(curview, viewmodel);
            if(curecp == whichSet){
                for(var i = 0; i < ambient.length; i++){
                    ambient[i] = (ambient[i] + Achange)%1;
                    //console.log(ka[i]);
                    diffuse[i] = (diffuse[i] + Dchange)%1;
                    specular[i] = (specular[i] + Schange)%1;
                }

                n = n + Nchange;
                n = n % 21;
                rc = 1.2;
                curblinn = blinn;
                mat4.rotateY(curview,curview, viewy * (Math.PI));
                mat4.rotateX(curview,curview, viewx * (Math.PI));
                mat4.rotateZ(curview,curview, viewz * (Math.PI));
                vec3.add(cureye,cureye,neweye);
            }
            var radiusA = inputEcllipes[whichSet].a * rc;
            var radiusB = inputEcllipes[whichSet].b * rc;
            var radiusC = inputEcllipes[whichSet].c * rc;

            var centerX = inputEcllipes[whichSet].x;
            var centerY = inputEcllipes[whichSet].y;
            var centerZ = inputEcllipes[whichSet].z;

            // console.log(radiusA,radiusB,radiusC);
            // console.log(centerX,centerY,centerZ);

            for (var lat = 0; lat <= latInt; lat++) {
              var theta = lat * Math.PI / latInt;
              var sinTheta = Math.sin(theta);
              var cosTheta = Math.cos(theta);

              for (var lon = 0; lon <= lonInt; lon++) {
                var phi = lon * 2 * Math.PI / lonInt;
                var sinPhi = Math.sin(phi);
                var cosPhi = Math.cos(phi);

                var x = cosPhi * sinTheta;
                var y = cosTheta;
                var z = sinPhi * sinTheta;


                x = radiusA * x + centerX;
                y = radiusB * y + centerY;
                z = radiusC * z + centerZ;
                var newver = [x,y,z];
                if(curecp == whichSet){
                    vec3.subtract (newver, newver, [centerX,centerY,centerZ]);
                    vec3.transformMat4(newver, newver, curview);
                    vec3.add(newver, newver, [centerX,centerY,centerZ]);
                }
                var normal = vec3.clone(getnormal(newver,[centerX,centerY,centerZ],[radiusA,radiusB,radiusC]));
                vec3.normalize(normal,normal);

                var color = lighting(cureye,lights,normal,newver,ambient,diffuse,specular,n,curblinn);
                vec3.subtract (newver, newver, rotateposition);
                vec3.transformMat4(newver, newver, viewmodel);
                vec3.add(newver, newver, rotateposition);
                var coord = transform(newver,cureye);

                coordArray.push(coord[0],coord[1],coord[2]);
                coordArray.push(color[0],color[1],color[2]);

                var first =  vtxBufferSize;
                var second = first + lonInt + 1;

                vtxBufferSize +=1;

                // console.log("vtxBufferSize:"+vtxBufferSize,first,second);
                indexArray.push(first,second,first + 1);
                indexArray.push(second,second + 1,first + 1);

                triBufferSize +=6;
              }
            }
            triBufferSize -=triBufferSize/latInt;
        } 
        
    } // end if triangles found
} // end load triangles

function getnormal(coord,center,radius){
    var x = (coord[0]*2-center[0]*2)/radius[0]/radius[0];
    var y = (coord[1]*2-center[1]*2)/radius[1]/radius[1];
    var z = (coord[2]*2-center[2]*2)/radius[2]/radius[2];
    return [x,y,z];
}

function bindBuffers(){

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer
        
        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer
}
// setup the webGL shaders
function setupShaders() {
    var fShaderCode = `


        precision lowp float;  
        varying lowp vec4 v_Color;

        void main(void) {
            gl_FragColor = v_Color; // all fragments are white
        }
    `;


    var vShaderCode = `

        precision lowp float;
        attribute vec3 vertexPosition;
        attribute vec3 vertexColor;
        varying lowp vec4 v_Color;

        void main(void) {
            gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
            v_Color = vec4(vertexColor,1.0);
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexColorAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexColor"); 
                gl.enableVertexAttribArray(vertexColorAttrib); // input to shader from array
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

function renderTriangles() {
    vertexBuffer = gl.createBuffer(); 
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW);
    triangleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,24,0); // feed
    gl.vertexAttribPointer(vertexColorAttrib,3,gl.FLOAT,false,24,12); // feed
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render

} // end render triangles

function redraw(light,eye){
    gl = null; 
    coordArray = [];
    indexArray = [];
    triBufferSize = 0;
    vtxBufferSize = 0;
    setupWebGL(); // set up the webGL environment
    loadTriangles(lights,Eye); // load in the triangles from tri file
    loadEllipes(lights,Eye); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL
   
}
/* MAIN -- HERE is where execution begins after window load */
var curKeys = [];

// ASSIGNMENT HELPER FUNCTIONS
function setupKeyEvent() {
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
}
function handleKeyUp(event) {
    curKeys[event.keyCode] = false;
}

function handleKeyDown(event) {
    curKeys[event.keyCode] = true;
    console.log(event.key);
    switch(event.key) {
        case "K" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            viewy = viewy + 0.1;
            break;
        case ":" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            viewy = viewy - 0.1;
            break;
        case "O" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            viewx = viewx + 0.1;
            break;
        case "L" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            viewx = viewx - 0.1;
            break;
        case "I" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            viewz = viewz + 0.1;
            break;
        case "P" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            viewz = viewz - 0.1;
            break;
        case "k" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            vec3.add(neweye,neweye,[0.1,0,0]);
            break;
        case ";" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            vec3.add(neweye,neweye,[-0.1,0,0]);
            break;
        case "o" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            vec3.add(neweye,neweye,[0,0,0.1]);
            break;
        case "l" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            vec3.add(neweye,neweye,[0,0,-0.1]);
            break;
        case "i" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            vec3.add(neweye,neweye,[0,-0.1,0]);
            break;
        case "p" :
            if(curecp == -1 && curtran == -1){
                break;
            }
            vec3.add(neweye,neweye,[0,0.1,0]);
            break;
        case "A" :
            mat4.rotateY(viewmodel,viewmodel, 0.1 * (Math.PI));
            break;
        case "D" : 
            mat4.rotateY(viewmodel,viewmodel, -0.1 * (Math.PI));
            break;
        case "W" :
            mat4.rotateX(viewmodel,viewmodel, 0.1 * (Math.PI));
            break;
        case "S" : 
            mat4.rotateX(viewmodel,viewmodel, -0.1 * (Math.PI));
            break;
        //console.log(event.key);
        case "q":
            vec3.add(Eye,Eye,[0,-0.1,0]);
            break;
        case "e":
            vec3.add(Eye,Eye,[0,0.1,0]);
            break;
        case "a":
            vec3.add(Eye,Eye,[0.1,0,0]);
            
            break;
        case "d":
            vec3.add(Eye,Eye,[-0.1,0,0]);
            break;
        case "w":
            vec3.add(Eye,Eye,[0,0,0.1]);
            break;
        case "s":
            vec3.add(Eye,Eye,[0,0,-0.1]);
            break;
        case "ArrowLeft":
            neweye = new vec3.fromValues(0,0,0);
            viewz = 0;
            viewx = 0;
            viewy = 0;
            Achange = 0;
            Dchange = 0;
            Schange = 0;
            Nchange = 0;
            blinn = true;
            curtran++;
            curecp = -1;
            if(curtran >= trannum){
                curtran = 0;
            }
            break;
        case "ArrowRight":
            neweye = new vec3.fromValues(0,0,0);
            viewz = 0;
            viewx = 0;
            viewy = 0;
            Achange = 0;
            Dchange = 0;
            Schange = 0;
            Nchange = 0;
            blinn = true;
            curtran--;
            curecp = -1;
            if(curtran < 0){
                curtran = trannum - 1;
            }
            break;
        case "ArrowUp":
            neweye = new vec3.fromValues(0,0,0);
            Achange = 0;
            Dchange = 0;
            Schange = 0;
            Nchange = 0;
            viewz = 0;
            viewx = 0;
            viewy = 0;
            blinn = true;
            curtran = -1;
            curecp++;
            if(curecp >= ecpnum){
                curecp = 0;
            }
            break;
        case "ArrowDown":
            neweye = new vec3.fromValues(0,0,0);
            Achange = 0;
            Dchange = 0;
            Schange = 0;
            Nchange = 0;
            viewz = 0;
            viewx = 0;
            viewy = 0;
            curtran = -1;
            blinn = true;
            curecp--;
            if(curecp < 0){
                curecp = ecpnum - 1;
            }
            break;
        case " ":
            neweye = new vec3.fromValues(0,0,0);
            Achange = 0;
            Dchange = 0;
            Schange = 0;
            Nchange = 0;
            viewz = 0;
            viewx = 0;
            viewy = 0;
            curecp = -1;
            curtran = -1;
            blinn = true;
            break;
        case "b":
            if(curecp == -1 && curtran == -1){
                break;
            }
            blinn = !blinn;
            break;
        case "2":
            if(curecp == -1 && curtran == -1){
                break;
            }
            Dchange = Dchange + 0.1;
            break;
        case "1":
            if(curecp == -1 && curtran == -1){
                break;
            }
            Achange = Achange + 0.1;
            break;
        case "3":
            if(curecp == -1 && curtran == -1){
                break;
            }
            Schange = Schange + 0.1;
            break;
        case "n":
            if(curecp == -1 && curtran == -1){
                break;
            }
            Nchange = Nchange + 1;
            break;
        case "Escape" :
            neweye = new vec3.fromValues(0,0,0);
            Achange = 0;
            Dchange = 0;
            Schange = 0;
            Nchange = 0;
            viewz = 0;
            viewx = 0;
            viewy = 0;
            curecp = -1;
            curtran = -1;
            blinn = true;
            Eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
            at = new vec3.fromValues(0,0,1);
            viewUp = new vec4.fromValues(0,1,0);
            rotateposition = vec3.fromValues(0.5,0.5,0.5);
            viewmodel = mat4.create();
            break;
        default:
            break;
    }
    redraw(lights, Eye);
   
}


function main() {
    setupWebGL(); // set up the webGL environment
    loadTriangles(lights,Eye); // load in the triangles from tri file
    loadEllipes(lights,Eye); 
    setupShaders(); // setup the webGL shaders
    renderTriangles();
    setupKeyEvent();
} // end main
