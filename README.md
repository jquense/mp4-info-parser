MP4 M4A Audio Metadata parser
=====================================

A simple streaming parser for retrieving mpeg4 metadata from an audio file

### Install

    npm install mp4-parser

### Use
The parser is simply a stream in objectMode, so you can pipe and binary data into it and it will spit out tag objects.

    var mp4 = require('mp4-parser')
      , stream = require('fs').createReadStream('./my-audio.m4a')

    var parser = stream.pipe(new mp4());

    parser.on('data', function(tag){
        console.log(tag.type)  // => 'aART'
        console.log(tag.value) // => 'Bastille'
    })

