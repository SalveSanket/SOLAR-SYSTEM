pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0'
    }

    environment {
        MONGO_URI = "mongodb+srv://superuser:SuperPassword@supercluster.paumtlt.mongodb.net/?retryWrites=true&w=majority&appName=superCluster"
        MONGO_USERNAME = credentials('MONGO_USERNAME')
        MONGO_PASSWORD = credentials('MONGO_PASSWORD')
        SONAR_SCANNER_HOME = tool 'sonarqube-scanner-610'
        DOCKER_CREDENTIALS_ID = 'dockerhub-credentials'
        AWS_EC2_HOST = '54.167.196.168'
        GITEA_TOKEN = credentials('GITEA_TOKEN')
    }

    options {
        disableConcurrentBuilds()
        disableResume()
    }

    stages {
        stage('Checkout Code') {
            options { timestamps(); retry(3) }
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }

        stage('VM Node Version') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            options { timestamps() }
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                sh 'npm install --include=dev --no-audit'
                echo '🔧 Dependencies installed successfully!'
            }
        }

        stage('Dependency Check') {
            options { timestamps() }
            parallel {
                stage('NPM Audit') {
                    steps {
                        echo '🔍 Running npm audit....'
                        sh 'npm audit --audit-level=critical'
                    }
                }
                stage('OWASP Check') {
                    steps {
                        echo '🛡️ Running OWASP Dependency Check...'
                        dependencyCheck additionalArguments: '''
                            --scan ./
                            --out ./ 
                            --format ALL 
                            --prettyPrint
                            --disableYarnAudit
                        ''', odcInstallation: 'OWASP-DepCheck'
                    }
                }
                stage('Seed Database') {
                    steps {
                        echo '🌱 Seeding database before tests...'
                        sh 'node seed.js'
                    }
                }
            }
        }

        stage('Unit Test') {
            options { timestamps(); retry(2) }
            steps {
                withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')]) {
                    echo '🧪 Running unit tests....'
                    sh 'npm test'
                }
            }
        }

        stage('Code Coverage & SonarQube') {
            options { timestamps() }
            parallel {
                stage('Code Coverage') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')]) {
                            catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                                echo '📊 Running code coverage....'
                                sh 'npm run coverage'
                            }
                        }
                    }
                }
                stage('SonarQube Scan') {
                    steps {
                        timeout(time: 60, unit: 'SECONDS') {
                            withSonarQubeEnv('sonar-qube-server') {
                                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                                    echo '🔍 Running SonarQube analysis...'
                                    sh '''
                                        o${SONAR_SCANNER_HOME}/bin/sonar-scanner \
                                        -Dsonar.projectKey=Solar_System-Project \
                                        -Dsonar.sources=app.js \
                                        -Dsonar.host.url=http://98.81.130.171:9000 \
                                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.inf
                                    '''
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Build Docker Image') {
            options { timestamps() }
            steps {
                echo '🐳 Building multi-architecture Docker image for amd64 and arm64...'
                withDockerRegistry([credentialsId: 'dockerhub-credentials', url: '']) {
                    sh '''
                        # Clean up old Docker images
                        docker rmi -f $(docker images -q) || true

                        # Create and use Buildx builder (skip if already exists)
                        docker buildx create --name multiarch-builder --use || docker buildx use multiarch-builder

                        # Build and push multi-architecture image
                        docker buildx build --platform linux/amd64,linux/arm64 \
                            -t indicationmark/solar-system-app:$GIT_COMMIT \
                            --push .
                    '''
                }
            }
        }

        stage('Trivy Scan') {
            steps {
                timestamps {
                    echo '🔍 Running Trivy vulnerability scan....'
                    catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                        script {
                            // Pull image locally
                            sh "docker pull indicationmark/solar-system-app:$GIT_COMMIT"

                            // Scan for critical vulnerabilities
                            sh """
                                trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                                --severity CRITICAL \
                                --exit-code 1 \
                                --quiet \
                                --format json \
                                -o trivy-image-CRITICAL-results.json
                            """

                            // Scan for medium and low vulnerabilities
                            sh """
                                trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                                --severity LOW,MEDIUM \
                                --exit-code 0 \
                                --quiet \
                                --format json \
                                -o trivy-image-MEDIUM-results.json
                            """
                        }
                    }
                }
            }
        }

        stage('Push Docker Image') {
            options { timestamps() }
            steps {
                echo '✅ Docker image was already pushed during multi-arch build stage using buildx --push. Skipping manual push.'
            }
        }

        stage('Deploy to AWS EC2') {
            options { timestamps() }
            when {
                branch pattern: "feature/.*", comparator: "REGEXP"
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'AWS_Deployment-Server_SSH-Key', keyFileVariable: 'EC2_KEY'),
                    usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')
                ]) {
                    echo '🌐 Deploying to AWS EC2....'
                    sh """
                        ssh -o StrictHostKeyChecking=no -i \$EC2_KEY ubuntu@${AWS_EC2_HOST} '
                            if sudo docker ps -a | grep -q solar-system-app; then
                                echo "🛑 Stopping existing container..."
                                sudo docker stop solar-system-app
                                sudo docker rm solar-system-app
                                echo "🗑️ Existing container removed."
                            fi
                            sudo docker run -d --name solar-system-app \
                                -e MONGO_URI="mongodb+srv://superuser:$MONGO_PASSWORD@supercluster.d83jj.mongodb.net/superData" \
                                -e MONGO_USERNAME=\$MONGO_USERNAME \
                                -e MONGO_PASSWORD=\$MONGO_PASSWORD \
                                -p 3000:3000 \
                                indicationmark/solar-system-app:$GIT_COMMIT
                            echo "🚀 New container started successfully!"
                        '
                    """
                }
            }
        }

        stage('Integration Testing') {
            options { timestamps() }
            when {
                branch pattern: "feature/.*", comparator: "REGEXP"
            }
            steps {
                withAWS(credentials: 'AWS Jenkins Credentials',region: 'us-east-1') {
                    echo '🧪 Running Integration Test...'
                    sh '''
                        chmod +x integrationTesting.sh
                        ./integrationTesting.sh
                    '''
                }
            }
        }

        stage('K8 update image tag') {
            options { timestamps() }
            when {
                branch 'main'
            }
            steps {
                echo '🔄 Updating Kubernetes deployment with new image tag...'
                sh 'rm -rf solar-system-gitops-argocd-gitea && git clone -b main https://$GITEA_TOKEN@gitea.com/nodejsApplicationProject/solar-system-gitops-argocd-gitea.git'
                dir('solar-system-gitops-argocd-gitea/Kubernetes') {
                    sh '''
                        git checkout -b feature/update-image-tag-$BUILD_ID
                        sed -i "s|indicationmark/solar-system-app:.*|indicationmark/solar-system-app:$GIT_COMMIT|g" deployment.yaml

                        git config user.name "Jenkins CI"
                        git config user.email "sanketsalve01@gmail.com"

                        git add deployment.yaml
                        git commit -m "Update Docker image tag to $GIT_COMMIT"
                        git push origin feature/update-image-tag-$BUILD_ID
                    '''
                }
            }
        }

        stage('Raise Pull Request in Gitea') {
            when {
                branch 'main'
            }
            steps {
                script {
                    def pr_title = "Update Docker image tag to ${GIT_COMMIT}"
                    def pr_body = "Auto-generated PR by Jenkins to update the Docker image tag to `${GIT_COMMIT}`."
                    def feature_branch = "feature/update-image-tag-${BUILD_ID}"
                    def base_branch = "main"
                    def repo_owner = "nodejsApplicationProject"
                    def repo_name = "solar-system-gitops-argocd-gitea"
                    def gitea_api_base = "https://gitea.com/api/v1"
                    
                    echo "🔁 Creating Pull Request from ${feature_branch} to ${base_branch}..."

                    sh """
                        curl -s -o response.json -w "%{http_code}" -X POST "${gitea_api_base}/repos/${repo_owner}/${repo_name}/pulls" \\
                        -H "Authorization: token ${GITEA_TOKEN}" \\
                        -H "Content-Type: application/json" \\
                        -d '{
                            "head": "${feature_branch}",
                            "base": "${base_branch}",
                            "title": "${pr_title}",
                            "body": "${pr_body}"
                        }' > status_code.txt

                        echo "Status: \$(cat status_code.txt)"
                        echo "Response: \$(cat response.json)"
                    """

                    def status = readFile('status_code.txt').trim()
                    if (status != "201") {
                        error "❌ Failed to create Pull Request. Status code: ${status}. See response.json for details."
                    } else {
                        echo "✅ Pull Request created successfully!"
                    }
                }
            }
        }

        stage('Manual Verification - App Deployment Check') {
            when {
                branch 'main'
            }
            steps {
                script {
                    env.ZAP_TARGET = "http://192.168.49.2:32002"
                    echo "🕵️‍♂️ Please verify the app is accessible at: ${env.ZAP_TARGET}"
                    input message: "Is the application running at ${env.ZAP_TARGET}?", ok: 'Yes, proceed'
                    echo "✅ Manual verification completed. Proceeding with OWASP ZAP DAST scan."
                }
            }
        }

        stage('OWASP ZAP DAST Scan') {
            when {
                branch 'main'
            }
            environment {
                ZAP_TARGET_URL = "http://192.168.49.2:32002"
            }
            steps {
                script {
                    echo "🔍 Starting OWASP ZAP DAST scan on ${ZAP_TARGET_URL}..."

                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        sh '''
                            # 🔄 Clean zap_output directory to avoid permission issues
                            rm -rf zap_output
                            mkdir -p zap_output

                            # 🐳 Run OWASP ZAP baseline scan using Docker
                            docker run --rm \
                                --user root \
                                --network="host" \
                                -v $(pwd)/zap_output:/zap/wrk \
                                ghcr.io/zaproxy/zaproxy:latest \
                                zap-baseline.py \
                                -t http://192.168.49.2:32002 \
                                -r zap-report.html \
                                -J zap-report.json \
                                -x zap-report.xml \
                                -m 2 -I || true
                        '''
                    }
                    echo "📄 ZAP scan completed. Publishing reports..."
                }
            }
        }

        stage('Upload - AWS S3') {
            when {
                branch 'main'
            }
            steps {
                withAWS(credentials: 'AWS Jenkins Credentials', region: 'us-east-1') {
                    echo '☁️ Uploading available test reports to AWS S3...'

                    sh '''
                        REPORT_DIR=reports-$BUILD_ID
                        mkdir -p $REPORT_DIR

                        echo "📦 Collecting available reports..."

                        [ -d coverage ] && cp -r coverage "$REPORT_DIR/"
                        [ -d zap_output ] && cp -r zap_output "$REPORT_DIR/"

                        for file in \
                            dependency-check-gitlab.json \
                            dependency-check-jenkins.html \
                            dependency-check-junit.xml \
                            dependency-check-report.csv \
                            dependency-check-report.html \
                            dependency-check-report.json \
                            dependency-check-report.sarif \
                            dependency-check-report.xml \
                            test-results.xml \
                            trivy-image-CRITICAL-results.json \
                            trivy-image-MEDIUM-results.json \
                            zap-report.html \
                            zap-report.json \
                            zap-report.xml
                        do
                            [ -f "$file" ] && cp "$file" "$REPORT_DIR/"
                        done

                        echo "✅ Final content in $REPORT_DIR:"
                        ls -lhR $REPORT_DIR
                    '''

                    s3Upload(
                        file: "reports-$BUILD_ID",
                        bucket: 'nodejs-app-reports-bucket-jenkins',
                        path: "reports-$BUILD_ID/"
                    )
                }
            }
        }

        stage('Lambda - S3 Upload and Deploy') {
            when {
                branch 'main'
            }
            steps {
                withAWS(credentials: 'AWS Jenkins Credentials', region: 'us-east-1') {
                    echo '🚀 Preparing Lambda-compatible package and uploading to S3...'

                    script {
                        def lambdaZip = "solar-system-lambda-${BUILD_ID}.zip"
                        sh """
                            echo "📦 Preparing Lambda build directory..."

                            mkdir -p lambda-build
                            cp app.js lambda-build/index.js
                            cp package.json lambda-build/
                            cp index.html lambda-build/
                            cp oas.json lambda-build/
                            cp -r node_modules lambda-build/

                            echo "📦 Zipping with index.js as Lambda entry..."
                            cd lambda-build
                            zip -qr ../${lambdaZip} *

                            cd ..
                            rm -rf lambda-build

                            echo "✅ Lambda zip created: ${lambdaZip}"
                        """

                        s3Upload(
                            file: lambdaZip,
                            bucket: 'solar-system-lambda-deployment-bucket',
                            path: "packages/"
                        )

                        sh '''
                            echo "🔧 Updating Lambda environment variables..."
                                aws lambda update-function-configuration \
                                    --function-name solar-system-lambda-function \
                                    --environment Variables="{\
                                    MONGO_URI=\\"$MONGO_URI\\",\
                                    MONGO_USERNAME=\\"$MONGO_USERNAME\\",\
                                    MONGO_PASSWORD=\\"$MONGO_PASSWORD\\"\
                                    }"
                                echo "✅ Lambda environment variables updated!"
                            '''

                        sh """
                            echo "🚀 Updating Lambda function..."
                            aws lambda update-function-code \\
                                --function-name solar-system-lambda-function \\
                                --s3-bucket solar-system-lambda-deployment-bucket \\
                                --s3-key packages/${lambdaZip} \\
                                --publish

                            echo "✅ Lambda function code updated!"

                            aws lambda invoke \\
                                --function-name solar-system-lambda-function \\
                                output.json

                            echo "📨 Lambda function invoked. Check output.json"
                        """
                    }
                }
            }
        }

        stage('Enforce Build Retention') {
            steps {
                sh '/usr/local/bin/jenkins-rotate-builds.sh'
            }
        }
    }

    post {
        always {
            script{
                if (fileExists('solar-system-gitops-argocd-gitea/Kubernetes/deployment.yaml')) {
                    echo '🔄 Kubernetes deployment file exists, proceeding with cleanup...'
                    sh 'rm -rf solar-system-gitops-argocd-gitea'
                } else {
                    echo '⚠️ Kubernetes deployment file does not exist, skipping cleanup.'
                }
            }

            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'coverage/lcov-report',
                reportFiles: 'index.html',
                reportName: 'Code Coverage Report'
            ])
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: './',
                reportFiles: 'dependency-check-jenkins.html',
                reportName: 'Dependency Check Report'
            ])
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: './',
                reportFiles: 'trivy-image-CRITICAL-results.html',
                reportName: 'Trivy Critical Report'
            ])
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'zap_output',
                reportFiles: 'zap-report.html',
                reportName: 'OWASP ZAP DAST Report'
            ])        
            catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                echo '📦 Archiving artifacts....'
                junit allowEmptyResults: true, testResults: 'test-results.xml'
            }
        }

        success {
            echo '✅ Build completed successfully!'
        }

        failure {
            echo '❌ Build failed. Check the logs.'
        }
    }
}
