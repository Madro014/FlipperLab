// Build without child processes, useful inside restricted desktop environments.
import {build} from 'vite';
import {transformAsync} from '@babel/core';
await build({configFile:false,esbuild:false,resolve:{preserveSymlinks:true},plugins:[{
 name:'portable-environment',enforce:'pre',transform(code){return code.includes('process.env.NODE_ENV')?{code:code.replaceAll('process.env.NODE_ENV','"production"'),map:null}:null;}
},{
 name:'portable-jsx',
 async transform(code,id){
  if(!id.endsWith('.jsx'))return null;
  const result=await transformAsync(code,{filename:id,configFile:false,babelrc:false,plugins:[['@babel/plugin-transform-react-jsx',{runtime:'automatic'}]]});
  return {code:result.code,map:null};
 }
}],build:{minify:false,cssMinify:false}});
