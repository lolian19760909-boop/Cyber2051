/* Message transport only. The builder supplies the shared parsing modules first. */
self.onmessage=function(event){
  const {id,kind,payload}=event.data;
  try{
    let value;
    if(kind==='parse')value=self.CxxGalParser.parseMessage(payload.raw,{cache:false});
    else if(kind==='summary')value=self.CxxStorySummaries.row(payload.message,payload.floor,self.CxxGalParser);
    else throw Error('未知历史解析任务');
    self.postMessage({id,value});
  }catch(error){
    self.postMessage({id,error:{message:error.message,code:error.code}});
  }
};
