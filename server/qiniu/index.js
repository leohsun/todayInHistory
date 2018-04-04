var config = require( './config')
var qiniu = require('qiniu')
var nanoid = require('nanoid') //生成随机字符
const key = nanoid()
var mac = new qiniu.auth.digest.Mac(config.AK, config.SK);
var conf= new qiniu.conf.Config();
var bucketManager = new qiniu.rs.BucketManager(mac, conf);


const url = 'http://img.lssdjt.com/200401/1/7517121366.jpg'

bucketManager.fetch(url, config.bucket, key, function(err, respBody, respInfo) {
    if (err) {
      console.log(err);
      //throw err;
    } else {
      if (respInfo.statusCode == 200) {
        console.log(respBody.key);
        console.log(respBody.hash);
        console.log(respBody.fsize);
        console.log(respBody.mimeType);
      } else {
        console.log(respInfo.statusCode);
        console.log(respBody);
      }
    }
  });
