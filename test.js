// UnitTest.js 
var chai = require('chai')
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , PassThrough = require('stream').PassThrough
  , mp4 = require('./mp4-parser');

chai.use(sinonChai);
chai.should();

describe("when parsing an audio file", function(){
    var parser, src;

    beforeEach(function(){
        src = new PassThrough();
        parser = new mp4()
          
        src.pipe(parser)  
    })

    it( 'should fail if not an mp4 file', function(done){

        parser.on('error', function(err){
            err.should.be.an.instanceOf(Error)
            err.message.should.equal('not a valid mpeg4 file')
            done() 
        })

        src.write(new Buffer('i\'m not an mp4 file', 'utf8'))
    })
    
    describe('when parsing a proper mp4 file', function(){
        
        beforeEach(function(){
            src = require('fs').createReadStream('./test.m4a')
            parser = new mp4()
            
            src.pipe(parser);
        })

        it('should emit the correct tags', function(done){
            var tags = {};

            parser
                .on('data', function(t){
                    if (t.type.charCodeAt(0) > 126 ) // cut off © for easier living
                        t.type = 'c' + t.type.substring(1);

                    tags[t.type] = t.value;
                })
                .on('end', function(){
                    tags.should.have.property('duration' ).that.is.closeTo(10, 0.1)
                    tags['calb'].should.equal('Silence')
                    tags['cART'].should.equal('Dummy')
                    tags['aART'].should.equal('The Dummies')
                    tags['ccmt'].should.equal('comment!')
                    tags['cnam'].should.equal('10 seconds of Silence')
                    tags['trkn'].should.equal('1/0')
                    tags['disk'].should.equal('1/2')
                    tags['covr'].should.have.deep.property('mime' ).that.equals('image/png')
                    tags['covr'].should.have.deep.property('data.length' ).that.equals(23867)
                    done()
                })
        })
    })
})

function readToEnd(str){
    
    str.on('readable', function(){
        while( null !== str.read() ){}
    })    
}