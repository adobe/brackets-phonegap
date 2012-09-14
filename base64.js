define(function (require, exports, module) {

var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
	charCode = String.fromCharCode;

// public method for encoding
exports.encode = function (input) {
    var output = "",
    	chr1, chr2, chr3, enc1, enc2, enc3, enc4,
    	i = 0;

    input = utf8_encode(input);

    while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output +
        keyStr.charAt(enc1) + keyStr.charAt(enc2) +
        keyStr.charAt(enc3) + keyStr.charAt(enc4);

    }

    return output;
};


exports.encodeBinary = function (input) {
	var output = "",
	  	bytebuffer,
	  	encodedCharIndexes = [],
	  	inx = 0,
	  	paddingBytes = 0;
   
	while (inx < input.length) {
		// Fill byte buffer array
		bytebuffer = new Array(3);
		for (jnx = 0; jnx < bytebuffer.length; jnx++)
			if (inx < input.length)
				bytebuffer[jnx] = input.charCodeAt(inx++) & 0xff; // throw away high-order byte, as documented at: https://developer.mozilla.org/En/Using_XMLHttpRequest#Handling_binary_data
			else
		bytebuffer[jnx] = 0;
   
		// Get each encoded character, 6 bits at a time
		// index 1: first 6 bits
		encodedCharIndexes[0] = bytebuffer[0] >> 2;  
		// index 2: second 6 bits (2 least significant bits from input byte 1 + 4 most significant bits from byte 2)
		encodedCharIndexes[1] = ((bytebuffer[0] & 0x3) << 4) | (bytebuffer[1] >> 4);  
		// index 3: third 6 bits (4 least significant bits from input byte 2 + 2 most significant bits from byte 3)
		encodedCharIndexes[2] = ((bytebuffer[1] & 0x0f) << 2) | (bytebuffer[2] >> 6);  
		// index 3: forth 6 bits (6 least significant bits from input byte 3)
		encodedCharIndexes[3] = bytebuffer[2] & 0x3f;  
   
		// Determine whether padding happened, and adjust accordingly
		paddingBytes = inx - (input.length - 1);
		switch (paddingBytes) {
			case 2:
			// Set last 2 characters to padding char
			encodedCharIndexes[3] = 64; 
			encodedCharIndexes[2] = 64; 
			break;
			case 1:
			// Set last character to padding char
			encodedCharIndexes[3] = 64; 
			break;
			default:
			break; // No padding - proceed
		}
		// Now we will grab each appropriate character out of our keystring
		// based on our index array and append it to the output string
		for (jnx = 0; jnx < encodedCharIndexes.length; jnx++) {
			output += keyStr.charAt(encodedCharIndexes[jnx]);
		}
	}
	return output;
};

// public method for decoding
exports.decode = function (input) {
    var output = "",
    	chr1, chr2, chr3,
    	enc1, enc2, enc3, enc4,
    	i = 0;

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < input.length) {

        enc1 = keyStr.indexOf(input.charAt(i++));
        enc2 = keyStr.indexOf(input.charAt(i++));
        enc3 = keyStr.indexOf(input.charAt(i++));
        enc4 = keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + charCode(chr1);

        if (enc3 != 64) {
            output = output + charCode(chr2);
        }
        if (enc4 != 64) {
            output = output + charCode(chr3);
        }

    }

    output = utf8_decode(output);

    return output;

};

// private method for UTF-8 encoding
var utf8_encode = function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";

    for (var n = 0; n < string.length; n++) {

        var c = string.charCodeAt(n);

        if (c < 128) {
            utftext += charCode(c);
        }
        else if((c > 127) && (c < 2048)) {
            utftext += charCode((c >> 6) | 192);
            utftext += charCode((c & 63) | 128);
        }
        else {
            utftext += charCode((c >> 12) | 224);
            utftext += charCode(((c >> 6) & 63) | 128);
            utftext += charCode((c & 63) | 128);
        }

    }

    return utftext;
};

// private method for UTF-8 decoding
var utf8_decode = function (utftext) {
    var string = "",
    	i = 0,
		c1, c2, c3,
    	c = c1 = c2 = 0;

    while ( i < utftext.length ) {

        c = utftext.charCodeAt(i);

        if (c < 128) {
            string += charCode(c);
            i++;
        }
        else if((c > 191) && (c < 224)) {
            c2 = utftext.charCodeAt(i+1);
            string += charCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
        }
        else {
            c2 = utftext.charCodeAt(i+1);
            c3 = utftext.charCodeAt(i+2);
            string += charCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }

    }

    return string;
};

});