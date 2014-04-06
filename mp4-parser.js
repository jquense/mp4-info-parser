var inherits = require('util').inherits
  , Tokenizr = require('stream-tokenizr')
  , binary = require('./binaryHelpers')
  , _ = require('lodash')
  , debug = require('debuglog')('mp4parser');


module.exports = Mp4Parser;

inherits(Mp4Parser, Tokenizr);

function Mp4Parser(){
    if ( !(this instanceof Mp4Parser) ) 
        return new Mp4Parser();

    Tokenizr.call(this, { objectMode: true })

    this.container = {};
    this.totalMetaLength = 0;

    this.readUInt32BE('length')
        .isEqual(new Buffer('ftyp'), 'not a valid mpeg4 file')
        .tap(function(tok){ 
            this.skip(tok.length)
        })
        .loop(function(end){
            this.readUInt32BE('length')
                .readString(4, 'utf8', 'type')
                .tap(function(tok){

                    if ( this.container.type === 'ilst')
                        return this.parseIlstItem(tok.type, tok.length - 8)
                    else if ( tok.type === 'meta' )
                        return this.skip(4) //padding! what is this?????
                    else if ( this.isContainer(tok.type) )
                        return this.container = _.clone(tok)
                    else if ( tok.type === 'mvhd' ) 
                        return this.parseHeader(tok.length)
                    else
                        return this.skip(tok.length - 8) //less size and type, next buff will be 'child' atoms (or siblings) who cares!
                })
                .tap(function(tok){
                    if ( this.checkEnd( tok.length ) ){
                        this.push(null);
                        end();  
                    }
                })
                .flush();
        })
}



Mp4Parser.prototype.checkEnd = function( length){
    var inIlst = this.container.type === 'ilst';

    if ( !inIlst ) return false;

    if ( this.totalMetaLength === 0 ) 
        this.totalMetaLength = length;
    else {
        if ( inIlst ) 
            this.totalMetaLength -= length;

        if ( this.totalMetaLength <= 0) 
            return true;
    }

    return false;
}


Mp4Parser.prototype.parseHeader = function(len){
    this.readUInt8('version')
        .skip(11)
        .readUInt32BE('timescale')
        .readUInt32BE('duration')
        .tap(function(tok){
            this.push({ type: 'duration', value: Math.round(tok.duration / tok.timescale) })
        })
        .skip(len - 8 - 20)
}

Mp4Parser.prototype.parseIlstItem = function(name, len){
    var self = this
      , i = 0;

    //this.totalMetaLength += len;

    this.readBuffer(len, function(buf){
        while (i < len) {
            var length = buf.readUInt32BE(i)
                , flag = FLAGS[buf.readUInt32BE(i + 8)]
                , data = buf.slice(i + 16, i + length)
                , value;

            if( name === "----") {
                return self.parseFreeForm(buf, name, len - 8);
            }
            else if( name === "free") {
                return;
            }
            else if(name === "trkn" || name === "disk") {
                value = data.readUInt16BE(2) + '/' + data.readUInt16BE(4)
            }
            else if(name === "tvsn" || name === "tves" || name === "cnID" || name === "sfID" || 
                    name === "atID" || name === "geID" || name === "gnre") {
                value = data.readUInt8(0);
            }
            else if(name === "cpil" || name === "pgap" || name === "pcst" || name === "hdvd") {
                value = (data.readUInt8(0) === 1);
            }
            else if(name === "stik" || name === "rtng" || name === "akID") {
                value = data[0];
            }
            else if(name == "tmpo") {
                value = data.readInt8(0)
            }
            else if(name === "covr") {
                value = {
                    mime: 'image/' + flag,
                    data: data    
                };
            }
            else {
                value = binary.decodeString(data, flag || 'utf8');
            }

            self.push({ type: name, value: value  });

            i += length;
        }
    })
}

//i'd like to once again thank taglib for guidance on parsing these correctly...
Mp4Parser.prototype.parseFreeForm = function(buf, name, len){
    var data = this.parseFreeFormData(buf, len)
      , type = data[2].flag
      , value;

    name = name += ":" + data[0].buffer.toString('utf8') + ":" + data[1].buffer.toString('utf8')

    if ( type == TYPES.utf8) 
        value = _.reduce(data.slice(2), function(rslt, item, idx){
                return rslt += binary.decodeString(item.buffer, 'utf8')
            }, '')
    else 
        value = Buffer.concat(_.pluck(data.slice(2), 'buffer'))

    this.push({ type: name, value: value  });
}

Mp4Parser.prototype.parseFreeFormData = function(buf, len){
    var MSG = "bad freeform atom, expecting: \"%s\", but got: \"%s\""
      , pos = 0
      , i = 0
      , data = [];

    while(pos < len) {
        var length = buf.readUInt32BE(pos)
          , name   = buf.toString('binary', pos + 4, pos + 8)
          , flag   = buf.readUInt32BE(pos + 8);
        
        if ( i > 1 ) {
            if ( name !== 'data' ) return debug(MSG, 'data', name), data;

            data.push({ name: name, buffer: buf.slice(pos + 16, pos + length), flag: flag})
        } else {
            if( i == 0 && name !== 'mean' ) debug(MSG, 'mean', name)
            if( i == 1 && name !== 'name' ) debug(MSG, 'name', name)

            data.push({ name: name, buffer: buf.slice(pos + 12, pos + length), flag: flag})  
        }

        pos += length;
        i++;
    } 
    
    return data;  
}

Mp4Parser.prototype.isContainer = function(type){
    return !!~['moov', 'udta', 'ilst', 'meta'].indexOf(type)
}

var FLAGS = {
        1 : 'utf8',
        2 : 'utf16',
        12: 'gif',
        13: 'jpeg',
        14: 'png',
        27: 'bmp',
        255: 'undefined'
    }
  , TYPES = _.invert(FLAGS)


